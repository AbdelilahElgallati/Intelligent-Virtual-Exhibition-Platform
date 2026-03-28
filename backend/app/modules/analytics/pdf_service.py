import os
import logging
import io
from datetime import datetime, timezone
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape
from xhtml2pdf import pisa

logger = logging.getLogger(__name__)


def _money_mad(amount: float) -> str:
    return f"{float(amount):,.2f} MAD".replace(",", " ")


class PDFService:
    def __init__(self, templates_dir: str):
        self.templates_dir = templates_dir
        self.jinja_env = Environment(
            loader=FileSystemLoader(templates_dir),
            autoescape=select_autoescape(['html', 'xml'])
        )
        # Add filters if needed
        self.jinja_env.filters['money_mad'] = _money_mad

    def generate_html(self, data: dict, template_name: str = "admin_platform_report") -> str:
        """Render HTML from data using a specific template."""
        if "generated_at" not in data:
            data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        
        # Ensure we have a .html extension
        if not template_name.endswith(".html"):
            template_path = f"{template_name}.html"
        else:
            template_path = template_name

        try:
            template = self.jinja_env.get_template(template_path)
            return template.render(**data)
        except Exception as e:
            logger.error(f"Failed to render HTML template {template_name}: {e}")
            # Fallback to a very basic HTML string if template missing
            return f"<html><body><h1>Report: {data.get('report_title', 'Analysis')}</h1><p>{e}</p></body></html>"

    def compile_pdf(self, html_content: str) -> bytes:
        """Compile HTML to PDF using xhtml2pdf."""
        result = io.BytesIO()
        try:
            pisa_status = pisa.CreatePDF(
                io.StringIO(html_content),
                dest=result,
                encoding='utf-8'
            )
            if pisa_status.err:
                logger.error(f"xhtml2pdf error: {pisa_status.err}")
                return None
            return result.getvalue()
        except Exception as e:
            logger.error(f"PDF compilation failed: {e}")
            return None

    def generate_report_pdf(self, data: dict, template_name: str = "admin_platform_report") -> bytes:
        """
        Main entry point for PDF generation.
        Renamed from generate_report_pdf for compatibility but now uses HTML.
        """
        try:
            html = self.generate_html(data, template_name)
            pdf = self.compile_pdf(html)
            if pdf:
                return pdf
            
            # If xhtml2pdf fails, we could fall back to ReportLab but let's try to fix HTML first
            logger.warning("xhtml2pdf failed, no fallback implemented yet (ReportLab removed for cleanliness)")
            return None
        except Exception as e:
            logger.error(f"Final PDF generation failure: {e}")
            return None

# Instantiate as 'latex_service' for backward compatibility with router.py imports
pdf_service = PDFService(os.path.join(os.path.dirname(__file__), "templates"))
latex_service = pdf_service 
