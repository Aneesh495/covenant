# ADR-002: Durable PostgreSQL Task Queue with Fencing Token Protection

## Status
Accepted

## Context
Background document analysis tasks require durable execution guarantees, lease timeouts, retry limits, and protection against split-brain execution. Introducing external message brokers (e.g. RabbitMQ or Redis) adds operational complexity, separate backup requirements, and distributed transaction boundaries across queues and the relational database. Furthermore, in distributed systems with worker crashes or GC pauses, a stale worker might wake up and overwrite the results of a newly assigned worker.

## Decision
We implement a native task queue directly in PostgreSQL utilizing `FOR UPDATE SKIP LOCKED`, periodic worker heartbeats, and monotonically increasing fencing tokens:

1. **Transactional Row Locking**:
   Workers claim pending or expired tasks using `FOR UPDATE SKIP LOCKED`. This guarantees zero lock contention across concurrent workers and eliminates duplicate leases.

2. **Lease Renewal via Heartbeats**:
   Leases are granted for 30-second windows. Active workers run a background heartbeat timer renewing `lease_expires_at` every 10 seconds. If a worker crashes, its lease automatically expires after 30 seconds and is picked up by a healthy worker.

3. **Fencing Token Protection**:
   Each lease acquisition increments `fencing_token` monotonically. When a worker completes its analysis, it initiates an atomic publication transaction that checks `WHERE fencing_token = $expectedToken` under row lock. If a stale worker attempts to write after its lease was reclaimed, the write is aborted with a `FENCING_TOKEN_MISMATCH` error.

4. **Atomic Publication Boundary**:
   Task completion, analysis run recording, findings insertion, and citations storage are executed within a single ACID transaction. The database state never exposes partial or orphaned findings.

## Consequences
- **Positive**: Zero external dependencies; backups of PostgreSQL capture queue state, document state, and analysis results atomically.
- **Positive**: Complete prevention of zombie worker overwrites during network partitions or GC pauses.
- **Tradeoff**: PostgreSQL connection pool must be sized appropriately to support concurrent polling workers alongside API HTTP requests.
