# -*- coding: utf-8 -*-
"""Gera docs/Checklist-Seguranca-GitHub.pdf"""
from pathlib import Path
from fpdf import FPDF

OUT = Path(__file__).with_name("Checklist-Seguranca-GitHub.pdf")
FONT_REG = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
LM = 16
RM = 16
CW = 210 - LM - RM  # usable width A4


class PDF(FPDF):
    def footer(self):
        self.set_y(-14)
        self.set_font("Doc", size=8)
        self.set_text_color(120, 120, 120)
        self.cell(
            0,
            8,
            f"Pagina {self.page_no()}/{{nb}}  |  10/07/2026  |  Premio Cripto v1.5.2",
            align="C",
        )


def line(pdf, text, size=10, style="", color=(30, 30, 30), h=5.5):
    pdf.set_x(LM)
    pdf.set_font("Doc", style=style, size=size)
    pdf.set_text_color(*color)
    pdf.multi_cell(CW, h, text, new_x="LMARGIN", new_y="NEXT")


def check(pdf, text):
    line(pdf, f"[ ]  {text}", size=10, h=5.5)


def main():
    if not FONT_REG.exists():
        raise SystemExit("Arial nao encontrada")
    bold = FONT_BOLD if FONT_BOLD.exists() else FONT_REG

    pdf = PDF(format="A4", unit="mm")
    pdf.set_margins(LM, 16, RM)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.alias_nb_pages()
    pdf.add_font("Doc", style="", fname=str(FONT_REG))
    pdf.add_font("Doc", style="B", fname=str(bold))
    pdf.add_font("Doc", style="I", fname=str(FONT_REG))
    pdf.add_page()

    line(pdf, "Checklist de seguranca - GitHub", size=18, style="B", color=(20, 20, 20), h=9)
    line(pdf, "O que VOCE precisa alterar (conta, repos, Cloudflare e PC)", size=11, color=(60, 60, 60), h=6)
    line(
        pdf,
        "Perfil: @joaoabitante  |  Repo: premioelisaofiscal  |  Data: 10/07/2026",
        size=9,
        color=(90, 90, 90),
        h=5,
    )
    pdf.ln(3)

    pdf.set_fill_color(232, 245, 233)
    pdf.set_font("Doc", "B", 10)
    pdf.set_text_color(27, 94, 32)
    pdf.set_x(LM)
    pdf.cell(CW, 7, "  Ja corrigido no codigo (v1.5.2 no GitHub)", fill=True, new_x="LMARGIN", new_y="NEXT")
    for t in [
        "[x] .gitignore reforcado (.env, chaves, .claude/, .cursor/, .grok/)",
        "[x] Pasta .claude/ removida do versionamento",
        "[x] SECURITY.md com canal de reporte",
        "[x] Checklist em docs/CHECKLIST-SEGURANCA-GITHUB.md",
    ]:
        line(pdf, "  " + t, size=9, color=(40, 40, 40), h=5)
    pdf.ln(3)

    pdf.set_fill_color(255, 243, 224)
    pdf.set_font("Doc", "B", 11)
    pdf.set_text_color(191, 54, 12)
    pdf.set_x(LM)
    pdf.cell(
        CW,
        8,
        "  FACA PRIMEIRO (15 minutos) se estiver cansado",
        fill=True,
        new_x="LMARGIN",
        new_y="NEXT",
    )
    for i, t in enumerate(
        [
            "Ativar 2FA no GitHub",
            "Fechar as 2 PRs do bot Cloudflare (se o deploy ja funciona)",
            "Bloquear force push na branch main",
            "Configurar e-mail noreply no git config",
            "Ativar Secret scanning + Push protection",
        ],
        1,
    ):
        check(pdf, f"{i}. {t}")
    pdf.ln(4)

    blocks = [
        (
            "1. Conta GitHub - autenticacao (critico - 5 min)",
            [
                "https://github.com/settings/security",
                "https://github.com/settings/sessions",
            ],
            [
                "Ativar 2FA (Authenticator app - melhor que SMS)",
                "Salvar codigos de recuperacao offline (papel/cofre), NAO no OneDrive do projeto",
                "Em Sessions: encerrar sessoes que voce nao reconhece",
            ],
            None,
        ),
        (
            "2. E-mail nos commits - privacidade (5 min)",
            ["https://github.com/settings/emails"],
            [
                "GitHub > Settings > Emails > Keep my email addresses private",
                "Marcar: Block command line pushes that expose my email",
                "Copiar o endereco noreply (NUMERO+joaoabitante@users.noreply.github.com)",
                'No PC: git config --global user.email "COLE_O_NOREPLY"',
                'git config --global user.name "Joao Abitante"',
                "Confirmar: git config --global --get user.email",
                "Proximo commit no GitHub ja sem Gmail real",
            ],
            "Nao reescreva o historico antigo so por e-mail. Foque nos commits novos.",
        ),
        (
            "3. Tokens, SSH e apps (critico - 10 min)",
            [
                "https://github.com/settings/keys",
                "https://github.com/settings/tokens",
                "https://github.com/settings/installations",
                "https://github.com/joaoabitante/premioelisaofiscal/pull/1",
                "https://github.com/joaoabitante/premioelisaofiscal/pull/2",
            ],
            [
                "Revisar SSH keys: so as que voce reconhece; apagar as outras",
                "Revogar PATs antigos/sem uso (preferir fine-grained + expiracao curta)",
                "NUNCA colar token em chat, issue, commit ou OneDrive do projeto",
                "Revisar app Cloudflare Workers and Pages (so repos de deploy)",
                "Remover apps GitHub que voce nao usa",
                "PR #1 e #2 do bot Cloudflare: ler o diff",
                "Se o site ja publica com push na main: Close PR sem merge",
                "So mergear se quiser wrangler.jsonc e souber que nao quebra o deploy",
                "Cloudflare: Web Analytics, RUM, Workers Logs/Logpush DESLIGADOS",
            ],
            None,
        ),
        (
            "4. Protecao da branch main (alto - 5 min)",
            ["https://github.com/joaoabitante/premioelisaofiscal/settings/branches"],
            [
                "Add branch protection rule com nome: main",
                "Restrict force pushes (bloquear force push)",
                "Restrict deletions",
                "Do not allow bypassing (se disponivel no plano)",
                "Opcional: exigir PR antes de merge (pode atrapalhar fluxo solo)",
                "Repetir em outros repos com deploy automatico",
            ],
            None,
        ),
        (
            "5. Code security do repositorio (medio - 5 min)",
            [
                "https://github.com/joaoabitante/premioelisaofiscal/settings/security_analysis",
                "https://github.com/settings/security_analysis",
            ],
            [
                "Dependency graph - Enable",
                "Dependabot alerts - Enable",
                "Secret scanning - Enable",
                "Push protection (secret scanning) - Enable",
                "Private vulnerability reporting - Enable",
                "Alinhar defaults da conta para repos novos",
            ],
            None,
        ),
        (
            "6. Features que viram spam + repos (baixo - 3 min)",
            ["https://github.com/joaoabitante?tab=repositories"],
            [
                "Desligar Wiki em cada repo publico que nao usa",
                "premioelisaofiscal - Wiki off (permanece publico OSS)",
                "abitanteventures - Wiki off",
                "mundialTAX, copa2026, aprendasobrekyc, compliance, trucolegends - Wiki off",
                "CONFIRMAR: elisaofiscal esta PRIVATE (produto fiscal)",
            ],
            None,
        ),
        (
            "7. Perfil e identidade (opcional - 2 min)",
            ["https://github.com/settings/profile"],
            [
                "Decidir nome exibido: civil completo ou marca publica",
                "Bio / site apontando para elisaofiscal.net se quiser",
                "Repo Premio > Settings > Website = https://premio.elisaofiscal.net",
            ],
            None,
        ),
        (
            "8. Cloudflare deploy (5 min)",
            [
                "https://dash.cloudflare.com",
                "https://dash.cloudflare.com/profile/api-tokens",
            ],
            [
                "Projeto do Premio ligado SO ao repo premioelisaofiscal",
                "Deploy automatico na branch main",
                "Web Analytics OFF",
                "RUM OFF",
                "Workers Logs / Logpush OFF",
                "Revogar API tokens Cloudflare nao usados; nunca commitar token",
            ],
            None,
        ),
        (
            "9. PC / Git local (5 min)",
            None,
            [
                "Credenciais: SSH ou Git Credential Manager (nao .git-credentials no OneDrive)",
                "Confirmar remote: so origin -> github.com/joaoabitante/premioelisaofiscal.git",
                "Se houver remote errado: git remote remove NOME",
                "Nunca git push --force em main de producao sem backup",
            ],
            None,
        ),
    ]

    for title, links, items, note in blocks:
        line(pdf, title, size=12, style="B", color=(25, 118, 210), h=7)
        pdf.set_draw_color(200, 200, 200)
        y = pdf.get_y()
        pdf.line(LM, y, LM + CW, y)
        pdf.ln(2)
        if links:
            for link in links:
                line(pdf, link, size=8, color=(80, 80, 80), h=4)
            pdf.ln(1)
        for it in items:
            check(pdf, it)
        if note:
            line(pdf, note, size=8, style="I", color=(100, 100, 100), h=4.5)
        pdf.ln(3)

    line(pdf, "O que NAO precisa fazer", size=12, style="B", color=(120, 30, 30), h=7)
    for t in [
        "Reescrever historico git so para trocar e-mail antigo",
        "Adicionar dependencias de seguranca no Premio (nao ha backend com auth)",
        "Tornar o Premio privado (e open source de proposito)",
    ]:
        line(pdf, f"  -  {t}", size=10, color=(40, 40, 40), h=5.5)

    pdf.ln(4)
    line(
        pdf,
        "Apos marcar as secoes 1 a 4, a higiene da conta fica alinhada a de um "
        "dev senior solo com deploy em producao.",
        size=9,
        style="I",
        color=(90, 90, 90),
        h=5,
    )
    line(
        pdf,
        "Fonte: docs/CHECKLIST-SEGURANCA-GITHUB.md | SECURITY.md | "
        "github.com/joaoabitante/premioelisaofiscal",
        size=8,
        color=(90, 90, 90),
        h=4,
    )

    pdf.output(str(OUT))
    print(f"OK {OUT.resolve()} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
