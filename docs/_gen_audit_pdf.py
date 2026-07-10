# -*- coding: utf-8 -*-
"""Gera PDF da auditoria multi-projeto."""
from pathlib import Path
from fpdf import FPDF

OUT = Path(__file__).with_name("Auditoria-Seguranca-Todos-Projetos.pdf")
FONT_REG = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
LM, RM = 14, 14
CW = 210 - LM - RM


class PDF(FPDF):
    def footer(self):
        self.set_y(-12)
        self.set_font("Doc", size=8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Pagina {self.page_no()}/{{nb}}  |  10/07/2026  |  Auditoria @joaoabitante", align="C")


def line(pdf, text, size=10, style="", color=(30, 30, 30), h=5):
    pdf.set_x(LM)
    pdf.set_font("Doc", style=style, size=size)
    pdf.set_text_color(*color)
    pdf.multi_cell(CW, h, text, new_x="LMARGIN", new_y="NEXT")


def main():
    bold = FONT_BOLD if FONT_BOLD.exists() else FONT_REG
    pdf = PDF(format="A4", unit="mm")
    pdf.set_margins(LM, 14, RM)
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.alias_nb_pages()
    pdf.add_font("Doc", "", str(FONT_REG))
    pdf.add_font("Doc", "B", str(bold))
    pdf.add_font("Doc", "I", str(FONT_REG))
    pdf.add_page()

    line(pdf, "Auditoria de seguranca - todos os projetos", size=16, style="B", h=8)
    line(pdf, "Joao Abitante (@joaoabitante)  |  10/07/2026", size=10, color=(80, 80, 80), h=5)
    line(pdf, "Escopo: pastas em Projetos + repos GitHub publicos + clones locais", size=9, color=(90, 90, 90), h=5)
    pdf.ln(2)

    pdf.set_fill_color(232, 245, 233)
    pdf.set_font("Doc", "B", 10)
    pdf.set_text_color(27, 94, 32)
    pdf.set_x(LM)
    pdf.cell(CW, 7, "  2FA GitHub: CONFIRMADO OK", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    line(pdf, "1. Resumo", size=13, style="B", color=(25, 118, 210), h=7)
    for t in [
        "CRITICO (secret versionado): 0",
        "Falso positivo Contbit 'Bearer': filtrado (codigo de sessao legítimo)",
        "Premio Cripto publico: OK (MIT, sem secrets, SECURITY.md)",
        "Produtos de negocio (Contbit, Cofre, simuladores...): PRIVATE no GitHub",
        "Cofre BTC: private + gitignore .env/*.key + SECURITY-PRIVACY.md",
        "Elisao Fiscal: nao listado como publico",
        "5+ repos locais sem gitignore (corrigido localmente nesta rodada)",
        "Pastas OneDrive sem git (Elisao zips, KYC-AML...): atencao a arquivos soltos",
    ]:
        line(pdf, f"- {t}", size=10, h=5)
    pdf.ln(2)

    line(pdf, "2. Faca nesta ordem", size=13, style="B", color=(191, 54, 12), h=7)
    for i, t in enumerate([
        "Confirmar no dashboard: cofre-btc-wallet e elisaofiscal = Private",
        "Contbit: RLS no Supabase; so chave publishable no front; nunca service_role no repo",
        "Contbit: NUNCA usar senha demo1234 em producao",
        "Secret scanning + push protection na conta e repos",
        "Branch protection main (force push bloqueado) nos repos com deploy",
        "Commit/push dos .gitignore novos nos repos que receberam o arquivo",
        "Email noreply nos commits novos",
        "Desligar Wiki nos 7 repos publicos se nao usa",
        "Fechar PRs Cloudflare do premio se deploy ja funciona",
    ], 1):
        line(pdf, f"[ ]  {i}. {t}", size=10, h=5.5)
    pdf.ln(2)

    line(pdf, "3. Por projeto (git local)", size=13, style="B", color=(25, 118, 210), h=7)

    projects = [
        ("premioelisaofiscal - OK", [
            "Publico OSS, MIT, sem secrets, CSP/PRIVACY/SECURITY",
            "Acao: PRs CF, wiki, branch protection",
        ]),
        ("APP Contbit (contadores) - ATENCAO", [
            "Private no GitHub (bom)",
            "URL Supabase + chave publishable hardcoded no app.js (padrao SPA)",
            "Seed SQL com senha demo demo1234 - so demo",
            "Acao: validar RLS; .env no gitignore (aplicado localmente)",
        ]),
        ("Contbit SaaS (landing) - BAIXO", [
            "Site estatico private; .gitignore criado localmente",
        ]),
        ("cofre-btc-wallet - CRITICO por natureza / higiene OK", [
            "Private; sem .env real no disco no scan",
            "Nunca tornar publico; seed so no dispositivo do usuario",
        ]),
        ("Abitante de Pallet, Neurocompliance, C.CLASSTRIB, simulador-autista", [
            "Private; faltava .gitignore - criado localmente nesta auditoria",
            "Neurocompliance: garantir zero dados reais de cliente no git",
        ]),
    ]
    for title, items in projects:
        line(pdf, title, size=11, style="B", color=(40, 40, 40), h=6)
        for it in items:
            line(pdf, f"  - {it}", size=9, color=(50, 50, 50), h=4.5)
        pdf.ln(1)

    line(pdf, "4. Publicos GitHub (7)", size=13, style="B", color=(25, 118, 210), h=7)
    line(pdf, "premioelisaofiscal (MIT) | abitanteventures | mundialTAX | copa2026 | aprendasobrekyc | compliance | trucolegends", size=9, h=5)
    line(pdf, "Quase todos: Wiki ON, sem LICENSE (exceto Premio). Pages em varios.", size=9, h=5)
    pdf.ln(1)

    line(pdf, "5. Pastas OneDrive SEM git", size=13, style="B", color=(25, 118, 210), h=7)
    for t in [
        "A Hora Elisao Fiscal - varios ZIP de release/whitelabel",
        "KYC-AML, Fator R, Mapa Mundial TAX - cuidado com dados/logica",
        "Nao guardar senhas Hostinger/tokens em .txt no OneDrive",
    ]:
        line(pdf, f"- {t}", size=9, h=4.5)
    pdf.ln(2)

    line(pdf, "6. O que o scan NAO achou (bom)", size=13, style="B", color=(27, 94, 32), h=7)
    for t in [
        "Nenhum ghp_ / github_pat_ versionado",
        "Nenhuma private key PEM versionada",
        "Nenhum .env real trackeado nos 8 gits",
        "Nenhuma AWS AKIA no codigo",
    ]:
        line(pdf, f"- {t}", size=9, h=4.5)

    pdf.ln(3)
    line(pdf, "Relatorio completo em Markdown:", size=9, style="I", color=(90, 90, 90), h=4)
    line(pdf, "premioelisaofiscal/docs/AUDITORIA-SEGURANCA-TODOS-PROJETOS.md", size=8, color=(90, 90, 90), h=4)
    line(pdf, "Checklist da conta: docs/Checklist-Seguranca-GitHub.pdf", size=8, color=(90, 90, 90), h=4)

    pdf.output(str(OUT))
    print(f"OK {OUT} ({OUT.stat().st_size})")


if __name__ == "__main__":
    main()
