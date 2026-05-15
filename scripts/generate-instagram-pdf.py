"""
Generate docs/instagram-option-a-setup.pdf from a templated structure.
Run from repo root:  python scripts/generate-instagram-pdf.py
"""
from pathlib import Path
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, ListFlowable, ListItem, KeepTogether,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "instagram-option-a-setup.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

# Brand colors (v3 palette)
TERRACOTTA = HexColor("#C75A3E")
NAVY = HexColor("#2C3E5C")
CREAM = HexColor("#FAF1E1")
INK = HexColor("#1F1A14")
MUTED = HexColor("#8A7E70")
LINE = HexColor("#E8DCC8")
GOLD_BG = HexColor("#FAF3E8")

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "title", parent=styles["Title"],
    fontName="Helvetica-Bold", fontSize=22,
    textColor=INK, leading=26, spaceAfter=4, alignment=TA_LEFT,
)
subtitle_style = ParagraphStyle(
    "subtitle", parent=styles["Normal"],
    fontName="Helvetica-Oblique", fontSize=12,
    textColor=MUTED, leading=15, spaceAfter=20,
)
h2_style = ParagraphStyle(
    "h2", parent=styles["Heading2"],
    fontName="Helvetica-Bold", fontSize=14,
    textColor=TERRACOTTA, leading=18, spaceBefore=18, spaceAfter=8,
)
h3_style = ParagraphStyle(
    "h3", parent=styles["Heading3"],
    fontName="Helvetica-Bold", fontSize=11,
    textColor=NAVY, leading=14, spaceBefore=10, spaceAfter=6,
)
body_style = ParagraphStyle(
    "body", parent=styles["Normal"],
    fontName="Helvetica", fontSize=10,
    textColor=INK, leading=14, spaceAfter=6,
)
mono_style = ParagraphStyle(
    "mono", parent=styles["Code"],
    fontName="Courier", fontSize=9,
    textColor=INK, leading=12,
    leftIndent=10, rightIndent=10,
    spaceAfter=8, spaceBefore=4,
    backColor=HexColor("#F4EBE0"),
    borderPadding=(8, 8, 8, 8),
)
note_style = ParagraphStyle(
    "note", parent=styles["Normal"],
    fontName="Helvetica-Oblique", fontSize=9.5,
    textColor=HexColor("#8A6630"), leading=13,
    leftIndent=10, rightIndent=10,
    backColor=HexColor("#FBEACB"),
    borderPadding=(8, 8, 8, 8),
    spaceAfter=8,
)

doc = SimpleDocTemplate(
    str(OUT),
    pagesize=LETTER,
    leftMargin=0.85 * inch, rightMargin=0.85 * inch,
    topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    title="Instagram Basic Display API Setup Guide",
    author="Claude",
)

story = []

# ── Title block ───────────────────────────────────────────────────────────
story.append(Paragraph("Instagram Basic Display API", title_style))
story.append(Paragraph("Setup Guide for Option A", ParagraphStyle(
    "subtitleBig", parent=title_style, fontSize=18,
    textColor=TERRACOTTA, fontName="Helvetica",
    leading=22, spaceAfter=6,
)))
story.append(Paragraph(
    "Everything you need to enable an auto-syncing Instagram feed on your site. "
    "Once steps 1–6 are done and your <font face='Courier'>.env</font> values are in place, "
    "the implementation work is on me.",
    subtitle_style,
))
story.append(Spacer(1, 6))

# ── Quick TOC ─────────────────────────────────────────────────────────────
toc_data = [
    ["1.", "Meta Developer Account (free)"],
    ["2.", "Create a Meta App"],
    ["3.", "Add the Instagram Basic Display product"],
    ["4.", "Configure OAuth redirect URIs"],
    ["5.", "Add yourself as an Instagram Tester"],
    ["6.", "Collect the three values I need"],
    ["7.", "(Optional) Privacy Policy URL"],
    ["8.", "What the dev will build"],
    ["9.", "Timeline summary"],
]
toc = Table(toc_data, colWidths=[0.4 * inch, 5.5 * inch])
toc.setStyle(TableStyle([
    ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
    ("TEXTCOLOR", (0, 0), (0, -1), TERRACOTTA),
    ("TEXTCOLOR", (1, 0), (1, -1), INK),
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 2),
]))
story.append(toc)
story.append(Spacer(1, 8))

# ── Section 1 ─────────────────────────────────────────────────────────────
story.append(Paragraph("1. Meta Developer Account (free)", h2_style))
story.append(Paragraph(
    "Go to <b>https://developers.facebook.com</b> &rarr; click <b>Get Started</b> &rarr; log in with your personal Facebook account (or create one). Accept the developer terms.",
    body_style,
))
story.append(Paragraph(
    "<b>What to send me:</b> nothing yet — just confirm you're past this step.",
    body_style,
))
story.append(Paragraph(
    "Important: this Facebook account doesn't need to be linked to anything — it's just the \"owner\" of the app you're about to create. Any FB account works.",
    note_style,
))

# ── Section 2 ─────────────────────────────────────────────────────────────
story.append(Paragraph("2. Create a Meta App", h2_style))
story.append(ListFlowable(
    [
        ListItem(Paragraph("Inside the developer dashboard, click <b>My Apps</b> &rarr; <b>Create App</b>", body_style)),
        ListItem(Paragraph("Use case: <b>Other</b>", body_style)),
        ListItem(Paragraph("App type: <b>Consumer</b>", body_style)),
        ListItem(Paragraph("App name: anything like <i>Cristina Bio</i> (internal — fans never see it)", body_style)),
        ListItem(Paragraph("Contact email: yours", body_style)),
        ListItem(Paragraph("Click <b>Create App</b>", body_style)),
    ],
    bulletType="1",
    leftIndent=20,
))

# ── Section 3 ─────────────────────────────────────────────────────────────
story.append(Paragraph("3. Add the Instagram Basic Display product", h2_style))
story.append(ListFlowable(
    [
        ListItem(Paragraph("From your new app's dashboard, scroll to <b>Add products to your app</b>", body_style)),
        ListItem(Paragraph("Find <b>Instagram Basic Display</b> &rarr; click <b>Set up</b>", body_style)),
        ListItem(Paragraph("Inside Instagram Basic Display, click <b>Create New App</b> (sets up an Instagram App alongside your Meta App)", body_style)),
        ListItem(Paragraph("Click <b>Save Changes</b>", body_style)),
    ],
    bulletType="1",
    leftIndent=20,
))

# ── Section 4 ─────────────────────────────────────────────────────────────
story.append(Paragraph("4. Configure OAuth redirect URIs", h2_style))
story.append(Paragraph(
    "These are the URLs Instagram sends users back to after authorizing. Inside <b>Instagram Basic Display &rarr; Basic Display</b>:",
    body_style,
))
story.append(Paragraph(
    "<b>Valid OAuth Redirect URIs:</b><br/>"
    "&nbsp;&nbsp;http://localhost:5000/api/instagram/oauth/callback<br/>"
    "&nbsp;&nbsp;https://your-real-domain.com/api/instagram/oauth/callback  (add when you deploy)<br/><br/>"
    "<b>Deauthorize Callback URL:</b><br/>"
    "&nbsp;&nbsp;http://localhost:5000/api/instagram/oauth/deauthorize<br/><br/>"
    "<b>Data Deletion Request URL:</b><br/>"
    "&nbsp;&nbsp;http://localhost:5000/api/instagram/oauth/data-deletion",
    mono_style,
))
story.append(Paragraph(
    "I'll implement the deauthorize + data-deletion endpoints on the backend — they're required by Meta but rarely actually called.",
    body_style,
))

# ── Section 5 ─────────────────────────────────────────────────────────────
story.append(Paragraph("5. Add yourself as an Instagram Tester", h2_style))
story.append(Paragraph(
    "Because the app starts in <b>Development Mode</b>, only people explicitly added as \"Instagram Testers\" can connect their Instagram. This is fine for now — when you go live to real fans, you flip the app to <b>Live Mode</b> (one form, ~5-minute review by Meta).",
    body_style,
))
story.append(ListFlowable(
    [
        ListItem(Paragraph("Instagram Basic Display &rarr; <b>User Token Generator</b> &rarr; click <b>Add or Remove Instagram Testers</b>", body_style)),
        ListItem(Paragraph("Enter your Instagram username: <font face='Courier'>cristinadd2m</font>", body_style)),
        ListItem(Paragraph("Open Instagram on your phone &rarr; <b>Settings</b> &rarr; <b>Apps and Websites</b> &rarr; <b>Tester Invites</b> &rarr; <b>Accept</b>", body_style)),
    ],
    bulletType="1",
    leftIndent=20,
))

# ── Section 6 ─────────────────────────────────────────────────────────────
story.append(PageBreak())
story.append(Paragraph("6. Collect the three values I need", h2_style))
table_data = [
    [Paragraph("<b>Where to find</b>", body_style), Paragraph("<b>What to copy</b>", body_style)],
    [
        Paragraph("Instagram Basic Display &rarr; Basic Display &rarr; <b>Instagram App ID</b>", body_style),
        Paragraph("<font face='Courier'>INSTAGRAM_APP_ID</font>", body_style),
    ],
    [
        Paragraph("Instagram Basic Display &rarr; Basic Display &rarr; <b>Instagram App Secret</b> (click \"Show\")", body_style),
        Paragraph("<font face='Courier'>INSTAGRAM_APP_SECRET</font>", body_style),
    ],
    [
        Paragraph("Your Instagram username", body_style),
        Paragraph("<font face='Courier'>cristinadd2m</font> (already have)", body_style),
    ],
]
t = Table(table_data, colWidths=[3.5 * inch, 2.4 * inch])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), GOLD_BG),
    ("GRID", (0, 0), (-1, -1), 0.5, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(t)
story.append(Spacer(1, 10))
story.append(Paragraph(
    "Treat the App Secret like a password — don't paste it in chat. Drop it into <font face='Courier'>server/.env</font> as:",
    body_style,
))
story.append(Paragraph(
    "INSTAGRAM_APP_ID=123456789012345<br/>"
    "INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pqr<br/>"
    "INSTAGRAM_REDIRECT_URI=http://localhost:5000/api/instagram/oauth/callback",
    mono_style,
))

# ── Section 7 ─────────────────────────────────────────────────────────────
story.append(Paragraph("7. (Optional) Privacy Policy URL", h2_style))
story.append(Paragraph(
    "Meta requires a Privacy Policy URL on the app's Basic Settings page when you go Live. For development you can paste a placeholder. For production:",
    body_style,
))
story.append(ListFlowable(
    [
        ListItem(Paragraph("Use a free generator: <font face='Courier'>https://www.termsfeed.com/privacy-policy-generator/</font>", body_style)),
        ListItem(Paragraph("Or ask the dev to write a minimal one tailored to this platform", body_style)),
    ],
    bulletType="bullet",
    leftIndent=18,
))

# ── Section 8 ─────────────────────────────────────────────────────────────
story.append(Paragraph("8. What the dev will build once those env vars are in place", h2_style))
story.append(ListFlowable(
    [
        ListItem(Paragraph("<b>\"Connect Instagram\"</b> button in Bio Builder &rarr; Instagram Posts card", body_style)),
        ListItem(Paragraph(
            "<b>Backend OAuth flow:</b><br/>"
            "&bull; <font face='Courier'>GET /api/instagram/oauth/start</font> &rarr; redirects to Instagram authorize URL<br/>"
            "&bull; <font face='Courier'>GET /api/instagram/oauth/callback</font> &rarr; exchanges code &rarr; stores long-lived 60-day token on the Creator row<br/>"
            "&bull; <font face='Courier'>GET /api/instagram/oauth/deauthorize</font> + <font face='Courier'>data-deletion</font> stubs (required by Meta)",
            body_style,
        )),
        ListItem(Paragraph(
            "<b>Schema additions</b> (auto-migrated by Sequelize):<br/>"
            "&bull; <font face='Courier'>Creator.instagramAccessToken</font><br/>"
            "&bull; <font face='Courier'>Creator.instagramTokenExpiry</font><br/>"
            "&bull; <font face='Courier'>Creator.instagramUserId</font><br/>"
            "&bull; <font face='Courier'>Creator.instagramUsername</font>",
            body_style,
        )),
        ListItem(Paragraph(
            "<b>Auto-fetch on <font face='Courier'>GET /api/instagram/:slug</font></b> — uses the stored token, fetches the latest 25 media items, caches for 1 hour, returns real CDN URLs (no more 403s).",
            body_style,
        )),
        ListItem(Paragraph(
            "<b>Token refresh job</b> — when the cached token is &lt;7 days from expiry, refresh in the background (Instagram's refresh endpoint, no re-auth required).",
            body_style,
        )),
    ],
    bulletType="bullet",
    leftIndent=18,
))
story.append(Paragraph("After it's all wired up:", body_style))
story.append(ListFlowable(
    [
        ListItem(Paragraph("You click <b>Connect Instagram</b> once.", body_style)),
        ListItem(Paragraph("Authorize in Instagram's flow.", body_style)),
        ListItem(Paragraph("Your 25 latest posts appear in the 3x3 grid automatically.", body_style)),
        ListItem(Paragraph("Posting a new IG post &rarr; it shows up on your site within an hour (cache TTL).", body_style)),
    ],
    bulletType="bullet",
    leftIndent=18,
))

# ── Section 9 ─────────────────────────────────────────────────────────────
story.append(Paragraph("9. Timeline summary", h2_style))
timeline_data = [
    [
        Paragraph("<b>Step</b>", body_style),
        Paragraph("<b>Who</b>", body_style),
        Paragraph("<b>Time</b>", body_style),
    ],
    [Paragraph("Steps 1-6 above", body_style), Paragraph("You", body_style), Paragraph("~15 min", body_style)],
    [Paragraph("Build backend + UI", body_style), Paragraph("Dev", body_style), Paragraph("~2 hours", body_style)],
    [Paragraph("Test together", body_style), Paragraph("Both", body_style), Paragraph("10 min", body_style)],
    [
        Paragraph("Switch app Dev &rarr; Live mode<br/>(one button + Meta's automated review)", body_style),
        Paragraph("You", body_style),
        Paragraph("~5 min + 1-3 days Meta review", body_style),
    ],
]
tl = Table(timeline_data, colWidths=[3.0 * inch, 1.0 * inch, 1.9 * inch])
tl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), GOLD_BG),
    ("GRID", (0, 0), (-1, -1), 0.5, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(tl)

story.append(Spacer(1, 18))
story.append(Paragraph(
    "Start whenever you're ready. Once steps 1-6 are done and the env vars are in <font face='Courier'>server/.env</font>, ping the dev and the wiring goes in.",
    note_style,
))

doc.build(story)
print(f"Wrote {OUT}")
