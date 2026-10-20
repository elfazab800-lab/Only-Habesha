ONLY HABESHA — Corrected website files

Files included:
- index.html: main page with Amharic/English switch, 18+ gate, membership plans, and existing dark purple/gold design. Selecting a plan opens the separate payment page.
- payment.html: separate payment page; reads the selected plan from the URL and shows Telebirr details and Telegram payment bot link.

Deploy/update on Vercel:
1. Extract this ZIP.
2. Upload/replace index.html and add payment.html in the same project root (same folder as index.html).
3. Commit and push to GitHub; Vercel should redeploy automatically.
4. Test all three plans and language switch on the deployed site.

Note: Payment verification is manual. This package does not implement an automated payment gateway or secure server-side admin authentication.
