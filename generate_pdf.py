import os
import urllib.request
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def generate():
    # Setup page size
    width, height = A4 # 595.27 x 841.89 points

    # Find and register a Japanese font (MS Gothic is standard on Windows)
    font_path = r"C:\Windows\Fonts\msgothic.ttc"
    if not os.path.exists(font_path):
        font_path = r"C:\Windows\Fonts\yugothm.ttc"

    # Register the font
    try:
        # TTC font index 0 is usually MS Gothic
        pdfmetrics.registerFont(TTFont("MSGothic", font_path, subfontIndex=0))
        font_name = "MSGothic"
    except Exception as e:
        print(f"Font registration failed: {e}. Falling back to Helvetica.")
        font_name = "Helvetica"

    # Create Canvas
    c = canvas.Canvas("poster.pdf", pagesize=A4)

    # Draw Cream Background (#FAF6F0)
    c.setFillColor(colors.HexColor("#FAF6F0"))
    c.rect(0, 0, width, height, fill=True, stroke=False)

    # --- HEADER SECTION ---
    # Logo Icon & Text
    c.setFillColor(colors.HexColor("#556B2F")) # Olive Green
    c.setFont("Helvetica", 18)
    c.drawString(40, height - 60, "🌿")
    c.setFont("Helvetica", 14)
    c.drawString(65, height - 58, "GARDEN FOCUS")

    # Catchphrase
    c.setFillColor(colors.HexColor("#8C8275"))
    c.setFont(font_name, 15)
    c.drawString(40, height - 100, "「はじめの１歩」を軽くする、集中を「育てる」タスク庭園。")

    # Title
    c.setFillColor(colors.HexColor("#2E2A25"))
    c.setFont("Helvetica", 42)
    c.drawString(40, height - 150, "MONO-FOCUS")

    # --- MAIN VISUAL ---
    # Preview Box Background (#FAF8F5)
    c.setFillColor(colors.HexColor("#FAF8F5"))
    c.setStrokeColor(colors.HexColor("#EAE2D5"))
    c.setLineWidth(1)
    c.roundRect(40, height - 420, width - 80, 240, 20, fill=True, stroke=True)

    # Draw Tree Illustration inside Box
    # Trunk
    c.setFillColor(colors.HexColor("#8B5A2B"))
    c.rect(width/2 - 5, height - 370, 10, 80, fill=True, stroke=False)
    # Foliage
    c.setFillColor(colors.HexColor("#556B2F"))
    c.circle(width/2, height - 280, 38, fill=True, stroke=False)
    c.setFillColor(colors.HexColor("#6B8E23"))
    c.circle(width/2 - 25, height - 300, 30, fill=True, stroke=False)
    c.setFillColor(colors.HexColor("#8FBC8F"))
    c.circle(width/2 + 25, height - 300, 30, fill=True, stroke=False)
    # Fruits (Apples & blossoms)
    c.setFillColor(colors.HexColor("#FF4D6D"))
    c.circle(width/2 - 10, height - 290, 6, fill=True, stroke=False)
    c.circle(width/2 + 18, height - 280, 7, fill=True, stroke=False)
    c.setFillColor(colors.HexColor("#FFD700"))
    c.circle(width/2 - 30, height - 310, 5, fill=True, stroke=False)
    c.setFillColor(colors.HexColor("#FF4D6D"))
    c.circle(width/2 + 5, height - 315, 6, fill=True, stroke=False)

    # Caption under Visual
    c.setFillColor(colors.HexColor("#5C544A"))
    c.setFont(font_name, 11)
    c.drawCentredString(width/2, height - 445, "課題を木として植え、進捗に合わせて美しく開花・結実するタスク管理ゲーム")

    # --- FEATURES SECTION ---
    card_w = (width - 80 - 30) / 3
    card_h = 130
    card_y = height - 600

    # Feature 1
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor("#EAE2D5"))
    c.roundRect(40, card_y, card_w, card_h, 12, fill=True, stroke=True)
    c.setFont(font_name, 18)
    c.drawString(55, card_y + 95, "⏱")
    c.setFillColor(colors.HexColor("#2E2A25"))
    c.setFont(font_name, 11)
    c.drawString(55, card_y + 75, "「チック音」タイマー")
    c.setFillColor(colors.HexColor("#8C8275"))
    c.setFont(font_name, 8.5)
    c.drawString(55, card_y + 50, "心地よい秒針チック音")
    c.drawString(55, card_y + 35, "がスマホへの誘惑を")
    c.drawString(55, card_y + 20, "完全に遮断します。")

    # Feature 2
    c.setFillColor(colors.white)
    c.roundRect(40 + card_w + 15, card_y, card_w, card_h, 12, fill=True, stroke=True)
    c.setFont(font_name, 18)
    c.drawString(55 + card_w + 15, card_y + 95, "🔮")
    c.setFillColor(colors.HexColor("#2E2A25"))
    c.setFont(font_name, 11)
    c.drawString(55 + card_w + 15, card_y + 75, "AIタスク自動小分け")
    c.setFillColor(colors.HexColor("#8C8275"))
    c.setFont(font_name, 8.5)
    c.drawString(55 + card_w + 15, card_y + 50, "Gemini AIが重い課題を")
    c.drawString(55 + card_w + 15, card_y + 35, "「2分で終わる」極小の")
    c.drawString(55 + card_w + 15, card_y + 20, "3ステップに分解。")

    # Feature 3
    c.setFillColor(colors.white)
    c.roundRect(40 + 2*card_w + 30, card_y, card_w, card_h, 12, fill=True, stroke=True)
    c.setFont(font_name, 18)
    c.drawString(55 + 2*card_w + 30, card_y + 95, "🍒")
    c.setFillColor(colors.HexColor("#2E2A25"))
    c.setFont(font_name, 11)
    c.drawString(55 + 2*card_w + 30, card_y + 75, "庭園デコレーション")
    c.setFillColor(colors.HexColor("#8C8275"))
    c.setFont(font_name, 8.5)
    c.drawString(55 + 2*card_w + 30, card_y + 50, "稼いだコインで噴水や")
    c.drawString(55 + 2*card_w + 30, card_y + 35, "ベンチを設置。タップ")
    c.drawString(55 + 2*card_w + 30, card_y + 20, "で心地よい音を奏でます。")

    # --- FOOTER SECTION ---
    # Divider Line
    c.setStrokeColor(colors.HexColor("#EAE2D5"))
    c.setLineWidth(1)
    c.line(40, 110, width - 40, 110)

    # Left Meta Info
    c.setFillColor(colors.HexColor("#8C8275"))
    c.setFont(font_name, 10)
    c.drawString(40, 85, "展示名: CHIBATECH PROTOTYPE (7/10)")
    c.setFont("Helvetica", 8)
    c.drawString(40, 70, "Stack: HTML5 Canvas / Vanilla CSS / Web Audio API / Gemini API (Serverless)")

    # Right QR code Area
    qr_path = "temp_qr.png"
    qr_downloaded = False

    try:
        qr_url = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://mono-focus-tau.vercel.app"
        urllib.request.urlretrieve(qr_url, qr_path)
        qr_downloaded = True
    except Exception as e:
        print(f"QR code download failed: {e}")

    if qr_downloaded and os.path.exists(qr_path):
        c.drawImage(qr_path, width - 110, 35, width=65, height=65)
        try:
            os.remove(qr_path)
        except:
            pass
    else:
        c.setFillColor(colors.white)
        c.setStrokeColor(colors.HexColor("#2E2A25"))
        c.setLineWidth(1)
        c.roundRect(width - 110, 35, 65, 65, 5, fill=True, stroke=True)
        c.setFillColor(colors.HexColor("#2E2A25"))
        c.setFont(font_name, 8)
        c.drawCentredString(width - 77, 65, "[ QR ]")

    c.setFillColor(colors.HexColor("#2E2A25"))
    c.setFont(font_name, 9)
    c.drawRightString(width - 125, 75, "今すぐブラウザで体験！")
    c.setFillColor(colors.HexColor("#8C8275"))
    c.setFont(font_name, 8)
    c.drawRightString(width - 125, 60, "コードからアクセス")

    # Save PDF
    c.save()
    print("Successfully generated poster.pdf")

if __name__ == "__main__":
    generate()
