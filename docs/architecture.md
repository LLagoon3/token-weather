# Architecture

## Summary

This project uses a hybrid architecture.

- Local agent for providers that need local auth/session reuse
- Backend direct pollers for providers with stable official usage endpoints
- Shared normalization layer for snapshots and events

## Main Components

### Local Agent
- provider auth resolution
- local usage endpoint probing
- event observation
- buffering and upload

### Backend API
- ingest normalized events
- poll direct provider endpoints when applicable
- aggregate state
- serve dashboard data

### Web Dashboard
- overview
- provider/account detail
- timeline
- health
