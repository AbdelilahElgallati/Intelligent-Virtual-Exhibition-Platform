import os
import subprocess
import logging
import io
from datetime import datetime, timezone
from jinja2 import Template

logger = logging.getLogger(__name__)

# LaTeX template content (as a backup if file not found)
LATEX_TEMPLATE_RAW = r"""
\documentclass[a4paper,12pt]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{geometry}
\geometry{a4paper, margin=1in, headheight=14.5pt}
\usepackage{helvet}
\renewcommand{\familydefault}{\sfdefault}
\usepackage{xcolor}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage{tcolorbox}
\usepackage{tabularx}
\usepackage{lastpage}
\usepackage{colortbl}

% Color Palette
\definecolor{primary}{HTML}{6D28D9}
\definecolor{secondary}{HTML}{059669}
\definecolor{graybg}{HTML}{F9FAFB}

% Header/Footer
\pagestyle{fancy}
\fancyhf{}
\lhead{\color{gray}\small IVEP - Intelligent Virtual Exhibition Platform}
\rhead{\color{gray}\small \today}
\lfoot{\color{gray}\small Confidential - Generated: {{ generated_at }}}
\rfoot{\color{gray}\small Page \thepage\ of \pageref{LastPage}}

\titleformat{\section}{\color{primary}\normalfont\Large\bfseries}{\thesection}{1em}{}[\titlerule]

\begin{document}

\begin{center}
    \vspace*{1cm}
    {\Huge \color{primary} \bfseries IVEP Analysis Report \par}
    \vspace{0.5cm}
    {\Large \color{secondary} {{ report_title }} \par}
    \vspace{1cm}
\end{center}

\section{Platform Overview}
\begin{center}
    {% for kpi in kpis %}
    \begin{tcolorbox}[colback=graybg, colframe=primary!20, width=0.3\textwidth, nobeforeafter, equal height group=kpis]
        \textbf{ {{ kpi.label }} } \\
        \LARGE \color{primary} {{ kpi.value }}
    \end{tcolorbox}
    {% if loop.index % 3 == 0 %}\\[0.3cm]{% else %}\hspace{0.2cm}{% endif %}
    {% endfor %}
\end{center}

\section{Business Metrics}
\begin{table}[h]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\textwidth}{X r}
\rowcolor{primary!10}
\textbf{Category} & \textbf{Amount (USD)} \\
\midrule
Ticket Revenue & \${{ revenue.ticket_revenue }} \\
Stand Revenue & \${{ revenue.stand_revenue }} \\
\midrule
\textbf{Total Revenue} & \textbf{\${{ revenue.total_revenue }} } \\
\bottomrule
\end{tabularx}
\end{table}

\section{Concluding Remarks}
This report summarizes the operational performance. Detailed metrics are available in the IVEP Admin Dashboard.

\end{document}
"""

class LaTeXService:
    def __init__(self, template_path: str = None):
        if template_path and os.path.exists(template_path):
            with open(template_path, "r", encoding="utf-8") as f:
                self.template = Template(f.read())
        else:
            self.template = Template(LATEX_TEMPLATE_RAW)

    def generate_tex(self, data: dict) -> str:
        """Generate LaTeX source from data."""
        if "generated_at" not in data:
            data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        return self.template.render(**data)

    def compile_pdf(self, tex_content: str) -> bytes:
        """
        Attempt to compile PDF using pdflatex.
        Falls back to reportlab if pdflatex is missing.
        """
        import tempfile
        import shutil

        # Check if pdflatex exists
        if shutil.which("pdflatex"):
            with tempfile.TemporaryDirectory() as tmpdir:
                tex_file = os.path.join(tmpdir, "report.tex")
                with open(tex_file, "w", encoding="utf-8") as f:
                    f.write(tex_content)
                
                try:
                    subprocess.run(
                        ["pdflatex", "-interaction=nonstopmode", "report.tex"],
                        cwd=tmpdir,
                        capture_output=True,
                        check=True,
                        timeout=30
                    )
                    pdf_path = os.path.join(tmpdir, "report.pdf")
                    if os.path.exists(pdf_path):
                        with open(pdf_path, "rb") as f:
                            return f.read()
                except Exception as e:
                    logger.error(f"LaTeX compilation failed: {e}")
        
        # Fallback to ReportLab if pdflatex fails or is missing
        logger.warning("pdflatex not found or failed, falling back to ReportLab")
        return None

    def generate_report_pdf(self, data: dict) -> bytes:
        """Generate PDF using LaTeX (if available) or ReportLab (fallback)."""
        tex = self.generate_tex(data)
        
        # Check if pdflatex exists
        import shutil
        if shutil.which("pdflatex"):
            pdf = self.compile_pdf(tex)
            if pdf:
                return pdf
        
        # Fallback to ReportLab using the actual data
        return self._generate_reportlab_pdf_from_data(data)

    def _generate_reportlab_pdf_from_data(self, data: dict) -> bytes:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        
        styles.add(ParagraphStyle(
            name='LatexTitle',
            parent=styles['Title'],
            fontName='Helvetica-Bold',
            fontSize=28,
            textColor=colors.HexColor("#6D28D9"),
            spaceAfter=12
        ))
        
        styles.add(ParagraphStyle(
            name='LatexHeading',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            textColor=colors.HexColor("#059669"),
            spaceBefore=12,
            spaceAfter=6
        ))

        story = []
        
        # Title & Header
        story.append(Paragraph("IVEP Analysis Report", styles['LatexTitle']))
        story.append(Paragraph(data.get("report_title", ""), styles['Heading2']))
        story.append(Paragraph(f"Generated: {data.get('generated_at', datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC'))}", styles['Normal']))
        story.append(Spacer(1, 1*cm))
        
        # Overview
        story.append(Paragraph("Overview", styles['LatexHeading']))
        story.append(Paragraph(data.get("overview_description", "Platform performance overview."), styles['Normal']))
        story.append(Spacer(1, 0.5*cm))
        
        # KPIs
        items = []
        for kpi in data.get("kpis", []):
            val = str(kpi.get('value', ''))
            unit = kpi.get('unit', '')
            items.append(ListItem(Paragraph(f"<b>{kpi.get('label', '')}</b>: {val} {unit}", styles['Normal'])))
        
        if items:
            story.append(ListFlowable(items, bulletType='bullet'))
        
        story.append(Spacer(1, 1*cm))
        
        # Revenue
        story.append(Paragraph("Business Metrics", styles['LatexHeading']))
        rev = data.get("revenue", {})
        rev_data = [
            ["Category", "Amount (USD)"],
            ["Ticket Revenue", f"${rev.get('ticket_revenue', 0.0):,.2f}"],
            ["Stand Revenue", f"${rev.get('stand_revenue', 0.0):,.2f}"],
            ["Total Revenue", f"${rev.get('total_revenue', 0.0):,.2f}"]
        ]
        
        t = Table(rev_data, colWidths=[6*cm, 4*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6D28D9")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#E5E7EB")),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        story.append(t)
        
        # Safety
        safety = data.get("safety", {})
        if safety:
            story.append(Spacer(1, 1*cm))
            story.append(Paragraph("Safety & Moderation", styles['LatexHeading']))
            story.append(Paragraph(f"<b>Total Flags</b>: {safety.get('total_flags', 0)}", styles['Normal']))
            story.append(Paragraph(f"<b>Resolved Flags</b>: {safety.get('resolved_flags', 0)}", styles['Normal']))
            story.append(Paragraph(f"<b>Resolution Rate</b>: {safety.get('resolution_rate', 0.0)}%", styles['Normal']))

        doc.build(story)
        return buf.getvalue()

latex_service = LaTeXService(os.path.join(os.path.dirname(__file__), "templates", "report.tex"))
