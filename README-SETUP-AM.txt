ONLY HABESHA — የመጀመሪያ ማዋቀሪያ

ፋይሎች:
- index.html: የደንበኞች ዋና ገጽ
- admin.html: የAdmin መግቢያ
- api/admin-login.js, api/admin-session.js, api/admin-logout.js, api/_auth.js: የአገልጋይ መግቢያ ማረጋገጫ
- vercel.json: የገጽ ራስጌ ቅንብር

አስፈላጊ:
1) ይህ ፕሮጀክት በVercel ላይ መደርደር አለበት። በቀጥታ GitHub Pages ላይ የAPI ፋይሎቹ አይሰሩም።
2) Vercel Project > Settings > Environment Variables ውስጥ ሁለት ሚስጥሮች ጨምር:
   ADMIN_PASSWORD = ረጅም፣ የማትጠቀምበት ሌላ የይለፍ ቃል
   ADMIN_SESSION_SECRET = ቢያንስ 32 የዘፈቀደ ቁምፊዎች ያሉት ሚስጥራዊ እሴት
3) እነዚህን እሴቶች በHTML/JavaScript ውስጥ አታስቀምጥ። በGitHub ላይ አታስገባቸው።
4) Environment Variables ከጨመርክ በኋላ Redeploy አድርግ።
5) Admin URL: https://YOUR-DOMAIN/admin.html
6) ይህ ኮድ የAdmin login ብቻ ያዘጋጃል። የክፍያ/አባላት ዳታቤዝ ወይም ቪዲዮ ማስተዳደር አያካትትም።

አሁን ባለው የGitHub index.html ላይ ይህን ፕሮጀክት ሲተካ የቀድሞው ሙሉ ይዘት እንደሚቀየር ልብ በል። ከመተካት በፊት የድሮውን ኮድ በተለየ ቦታ አስቀምጥ።
