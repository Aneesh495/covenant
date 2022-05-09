# replit.md

## Overview

This is an AI-powered legal contract analyzer SaaS application built with React, Express, and PostgreSQL. The platform allows users to upload legal documents (PDF, DOCX) and receive structured clause extraction, AI-generated summaries, and risk assessment powered by OpenAI's GPT-4 API.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a full-stack architecture with clear separation of concerns:

- **Frontend**: React with TypeScript, using Vite as the build tool
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth integration with session management
- **File Processing**: Multer for file uploads with support for PDF and DOCX parsing
- **AI Integration**: OpenAI GPT-4 API for contract analysis
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state management

## Key Components

### Frontend Architecture
- **Component Library**: Built on shadcn/ui with Radix UI primitives
- **Routing**: Wouter for client-side routing
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: React Query for server state and caching
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **API Structure**: RESTful endpoints under `/api` prefix
- **File Upload**: Multer middleware with 10MB file size limit
- **Text Extraction**: Placeholder implementations for PDF and DOCX parsing
- **AI Processing**: OpenAI integration for contract analysis
- **Error Handling**: Centralized error middleware

### Database Schema
- **Users**: Authentication and profile data (required for Replit Auth)
- **Sessions**: Session storage (required for Replit Auth)
- **Contracts**: File metadata and analysis status
- **Clauses**: Individual clause data with categorization and risk levels
- **Analysis Summaries**: Overall contract analysis results

## Data Flow

1. **User Authentication**: Replit Auth handles OAuth flow and session management
2. **File Upload**: Users upload contracts through drag-and-drop interface
3. **Text Extraction**: Backend extracts text from PDF/DOCX files
4. **AI Analysis**: OpenAI API analyzes contract text for clauses and risks
5. **Data Storage**: Results stored in PostgreSQL with relational structure
6. **UI Display**: React frontend displays analysis with syntax highlighting

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL via `@neondatabase/serverless`
- **ORM**: Drizzle with PostgreSQL dialect
- **AI Service**: OpenAI API for contract analysis
- **Authentication**: Replit Auth with OIDC integration
- **File Processing**: Multer for multipart form handling

### Frontend Libraries
- **UI Components**: Extensive Radix UI component collection
- **Styling**: Tailwind CSS with shadcn/ui design system
- **Icons**: Lucide React icon library
- **State Management**: TanStack React Query
- **Routing**: Wouter lightweight router

### Development Tools
- **Build Tool**: Vite with React plugin
- **TypeScript**: Full type safety across frontend and backend
- **Development**: TSX for TypeScript execution
- **Linting**: ESBuild for production builds

## Deployment Strategy

The application is configured for Replit deployment with:

- **Development**: `npm run dev` starts both frontend and backend in development mode
- **Production Build**: Vite builds frontend assets, ESBuild bundles backend
- **Static Serving**: Express serves built React application in production
- **Environment Variables**: Database URL and OpenAI API key required
- **Session Storage**: PostgreSQL-backed sessions for authentication persistence

### Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API access key (provided by user)
- `SESSION_SECRET`: Secret for session encryption
- `REPL_ID`: Replit environment identifier
- `ISSUER_URL`: OIDC issuer URL for authentication

### Recent Changes
- **January 23, 2025**: Integrated real OpenAI API key for contract analysis
- **January 23, 2025**: Added PDF parsing with pdf-parse library and DOCX support with mammoth
- **January 23, 2025**: Removed Stripe billing integration to keep application completely free
- **January 23, 2025**: Enhanced demo mode with comprehensive sample analysis data
- **January 23, 2025**: Fixed TypeScript errors and improved error handling

### File Structure
- `client/`: React frontend application
- `server/`: Express backend API
- `shared/`: Shared TypeScript types and schemas
- `migrations/`: Drizzle database migrations
- `uploads/`: Temporary file storage for processing

The application implements a freemium model with Stripe integration planned for billing, though payment processing is not yet fully implemented. The architecture supports scaling through proper separation of concerns and modern tooling choices.