# Operational Runbook: Covenant Workbench Operations and Troubleshooting

## 1. Prerequisites and Environment Setup

- **Node.js**: LTS version (Node 20+ or 24+ supported).
- **PostgreSQL**: Version 15+ with `pgvector` extension enabled.
- **Port Allocation**:
  - API and Vite Dev Server: `5000` (configurable via `PORT`).
  - PostgreSQL Database: `5432`.

### 1.1 Initial Bootstrap
Run the automated bootstrap command to install dependencies and execute SQL migrations:
```bash
make bootstrap
```
This applies all 4 Drizzle migrations in `packages/persistence/src/migrations/`:
- `0000_core_schema.sql`: Workspaces, members, documents, versions, source blocks.
- `0001_retrieval_and_vector.sql`: Vector chunks with 384-dimensional embeddings.
- `0002_task_queue_and_runs.sql`: Analysis tasks, runs, findings, citations.
- `0003_audit_and_revisions.sql`: Append-only audit events and revision links.

---

## 2. Launching Services

### 2.1 Full Development Environment
To launch the authenticated API server, Vite client, and background worker concurrently:
```bash
make dev
```

### 2.2 Interactive Demo Environment
To seed the database with realistic sample contracts (NDAs with non-compliant clauses) and resumes (Principal Distributed Systems Engineer), then launch the UI:
```bash
make demo
```
Navigate to `http://localhost:5000` to interact with the workbench.

### 2.3 Individual Service Management
- Start API only: `make dev-api`
- Start Background Worker only: `make dev-worker`

---

## 3. Monitoring Worker Health and Queues

### 3.1 Active Lease Inspection
To inspect in-flight worker leases and active task execution, query PostgreSQL directly:
```sql
SELECT id, workflow, status, lease_worker_id, fencing_token,
       lease_expires_at, attempts, next_attempt_after
FROM analysis_tasks
WHERE status IN ('leased', 'running')
ORDER BY created_at ASC;
```

### 3.2 Dead-Letter and Failed Tasks
Tasks that exceed maximum retry attempts (`max_attempts = 3`) transition to `'failed'`:
```sql
SELECT id, workflow, attempts, last_error_code, last_error, updated_at
FROM analysis_tasks
WHERE status = 'failed'
ORDER BY updated_at DESC;
```

---

## 4. Incident Response and Troubleshooting

### 4.1 Worker Process Crash or Interruption
- **Symptom**: A worker terminates unexpectedly due to an out-of-memory error or host termination.
- **Root Cause**: The active lease on `analysis_tasks` remains in `'leased'` or `'running'` state with an active `fencing_token`.
- **Automated Recovery**: Surviving workers automatically detect expired leases (`lease_expires_at < NOW()`). Upon the next polling cycle, a surviving worker reclaims the task via `FOR UPDATE SKIP LOCKED`, increments the `fencing_token`, and resumes processing.
- **Manual Intervention**: None required under standard operations. To manually release all expired leases immediately:
  ```sql
  UPDATE analysis_tasks
  SET status = 'pending', lease_worker_id = NULL
  WHERE status IN ('leased', 'running') AND lease_expires_at < NOW();
  ```

### 4.2 Fencing Token Mismatch
- **Symptom**: Worker logs report:
  `TaskLeaseError: Fencing token mismatch: expected token X but task has token Y`.
- **Root Cause**: A worker experienced a long pause (such as a garbage collection pause or network timeout), during which its 30-second lease expired and another worker took over.
- **Remediation**: This is the expected and correct behavior of the fencing protocol. The stale worker's commit is safely rejected, preventing data corruption. No manual remediation is necessary.

### 4.3 Database Migration Lock
- **Symptom**: Migration hangs waiting for a lock on `workspaces` or `document_versions`.
- **Remediation**: Check for uncommitted transactions holding row or table locks:
  ```sql
  SELECT pid, age(clock_timestamp(), query_start), query, state
  FROM pg_stat_activity
  WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%';
  ```
  Terminate blocking transactions if necessary using `SELECT pg_terminate_backend(pid);`.
