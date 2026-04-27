# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-01-02

### Changed - Major Refactoring

#### Migration from Elysia to Pure Bun
- **Removed Dependencies**: Removed Elysia framework and all related packages (@elysiajs/stream, @elysiajs/swagger, @sinclair/typebox)
- **Native Bun Server**: Implemented using `Bun.serve()` with native Web APIs
- **Simplified Stack**: Reduced from 5+ framework dependencies to just 2 AI SDK dependencies

#### API Improvements
- **Renamed Endpoints**:
  - `/chat` → `/chat/stream` (for streaming responses)
  - `/test` → `/chat/complete` (for complete responses)
- **Better Response Types**:
  - Streaming endpoint now returns `text/plain` with proper chunked encoding
  - Complete endpoint returns JSON with structured success/error responses
- **Enhanced Validation**: Custom request validation with detailed error messages
- **Health Check**: New GET `/` endpoint for service status

#### Code Quality
- **Type Safety**: Added explicit TypeScript types throughout
- **Error Handling**: Improved error handling with detailed logging and user-friendly messages
- **Code Organization**: Separated concerns with helper functions
- **Best Practices**:
  - Proper use of ReadableStream API
  - Clean separation of streaming vs complete response logic
  - Graceful handling of client disconnections

#### Docker & DevOps
- **Multi-stage Dockerfile**: Optimized build with dependency caching
- **Health Checks**: Added Docker health checks
- **Dev/Prod Profiles**: Separate Docker Compose profiles for development and production
- **Better Defaults**: Environment variable fallbacks and sensible defaults

#### Documentation
- **Comprehensive README**: Complete API documentation with examples
- **Example Scripts**: Added `test-api.sh` for easy endpoint testing
- **Better .env.example**: More detailed environment variable documentation

### Performance Improvements
- Removed unnecessary framework overhead
- Direct use of Bun's native HTTP server (faster request handling)
- Smaller Docker images with multi-stage builds
- Reduced memory footprint

### Breaking Changes
- All endpoints have been renamed (see API Improvements above)
- Response format for complete endpoint changed to include `success` field
- Swagger documentation removed (API is now documented in README)
- Content-Type for streaming changed from `text/event-stream` to `text/plain`

### Migration Guide

#### If you were using `/chat`:
```bash
# Old
POST /chat

# New
POST /chat/stream
```

#### If you were using `/test`:
```bash
# Old
POST /test

# New
POST /chat/complete
```

#### Response Format Changes:
```json
// Old /test response
{
  "response": "...",
  "service": "groq"
}

// New /chat/complete response
{
  "success": true,
  "response": "...",
  "service": "groq"
}
```

## [1.0.0] - Previous Version

### Features
- Initial implementation with Elysia framework
- Swagger documentation
- Basic streaming and non-streaming endpoints
- Load balancing between Groq and Cerebras
