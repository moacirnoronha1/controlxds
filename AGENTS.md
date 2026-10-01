# Project architecture

- Keep price intelligence read-only and derive it exclusively from inventory entry lots and their linked entry movements, so reporting never changes stock.
- Treat cancelled HTTP requests as client disconnects rather than application failures, so navigation cannot replace the app with an error page.