# HMA Smart‑Find System

## Setup

1. Clone the repository.
2. Run `npm install`.
3. Create a `.env` file with your EmailJS keys (or hardcode them in `public/js/config.js` and `report.js`).
4. Run `node server.js` to start the server.
5. Visit `http://localhost:3000`.

## Database

SQLite file `hma.db` will be created automatically with sample data.

## QR Codes

Run the Python script in `scripts/` to generate QR codes for all items.