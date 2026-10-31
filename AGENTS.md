# Project architecture

- Keep price intelligence read-only and derive it exclusively from inventory entry lots and their linked entry movements, so reporting never changes stock.
- Treat cancelled HTTP requests as client disconnects rather than application failures, so navigation cannot replace the app with an error page.
- Wrap entry/product-save database calls in the shared timeout helper and send a retry-stable idempotency key, so a hung request never locks the form and a retry never duplicates stock.
