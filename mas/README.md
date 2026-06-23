# MAS (Master Archive Search) - FamilySearch Integration

This directory contains the FamilySearch integration for the CIC enrichment pipeline.

## Structure

```
mas/
├── config/
│   └── archive_credentials.json    # FamilySearch OAuth credentials (placeholder)
├── lib/
│   └── credential-loader.js        # Credential loading utility
├── adapters/
│   ├── familysearch-oauth.js       # OAuth token exchange
│   ├── familysearch-tree.js        # Tree/Person endpoint
│   ├── familysearch-refresh.js     # Token refresh flow
│   ├── familysearch-person-search.js # Person search endpoint
│   └── familysearch-memories.js    # Memories/artifacts endpoint
├── agents/
│   └── enrichment-familysearch.js  # EnrichmentAgent provider
└── README.md
```

## Setup

1. **Fill in credentials** in `config/archive_credentials.json`:
   - `client_id`: Already set to `b00CRWK5ZJ3M121I4YMO`
   - `client_secret`: Obtain from FamilySearch
   - `redirect_uri`: Confirm with FamilySearch (default: `http://localhost:5173/callback`)

2. **Integration points**:
   - EnrichmentAgent imports `FamilySearchProvider` from `enrichment-familysearch.js`
   - Provider implements `enrich()` (search → fetch person → return matches)
   - Provider implements `refreshToken()` for token lifecycle

## Endpoints

- **OAuth**: `https://ident.familysearch.org/cis-web/oauth2/v3/token`
- **Tree**: `https://api.familysearch.org/platform/tree/persons/{personId}`
- **Search**: `https://api.familysearch.org/platform/tree/search?q={query}`
- **Memories**: `https://api.familysearch.org/platform/memories/memories?person={personId}`

## Flow

```
EnrichmentAgent
  ├─ searchPersons(query) → [results]
  ├─ getPersonById(personId) → { person, raw }
  ├─ getMemoriesForPerson(personId) → { items, raw }
  └─ refreshFamilySearchToken(refresh_token) → { access_token, ... }
```
