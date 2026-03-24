# ALPET Bot

ALPET is a news-driven trading engine focused on translating real global events into Turkey market impact across BIST, VIOP, and MT5 instruments.

## Current state

This repository is an implementation scaffold for the architecture defined in the project brief. It includes:

- project structure
- environment bootstrap
- normalized event schema
- collector and analyzer stubs
- scoring and decision flow
- risk and execution stubs

## Principles

- real news only
- no technical indicators as signal source
- current event plus historical similar events
- explainable `IGNORE`, `WATCH`, `EXECUTE` outputs
- risk-gated execution

## Run

```bash
npm install
cp .env.example .env
npm start
```

## Initial source scope

- KAP RSS
- TCMB official announcements
- Bloomberg HT RSS
- Anadolu Ajansi economy feed

## Initial instrument scope

- USDTRY
- XAUUSD
- BRENT
- VIOP30
- THYAO
- PGSUS
- TUPRS
- KOZAL
- GARAN
- AKBNK

## Repository layout

```text
src/
  collectors/
  analyzers/
  execution/
  risk/
  storage/
  utils/
config/
docs/
```

## Notes

- The current implementation is safe-by-default and does not route live trades unless explicitly enabled.
- The decision engine defaults unknown or weakly supported themes to `WATCH`.
- Historical matching is scaffolded and meant to be backed by real stored event history.