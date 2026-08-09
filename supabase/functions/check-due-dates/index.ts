import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from "https://esm.sh/nodemailer@6.9.13";

// Credenciais do Gmail que você vai configurar nos Secrets do Supabase
const GMAIL_USER = Deno.env.get('GMAIL_USER') // ex: seuemail@gmail.com
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') // A senha de 16 dígitos

serve(async (req) => {
  try {
    // 1. Inicializa o cliente do Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Calcula as datas com fuso horário de Brasília (UTC-3)
    const now = new Date()
    
    // Ajusta a data atual subtraindo 3 horas (Fuso horário de Brasília)
    const today = new Date(now.getTime() - (3 * 60 * 60 * 1000))
    
    // Clona a data de hoje e adiciona 5 dias
    const fiveDaysFromNow = new Date(today)
    fiveDaysFromNow.setDate(today.getDate() + 5)

    // Extrai apenas a parte "YYYY-MM-DD" baseada no horário de Brasília
    const todayStr = today.toISOString().split('T')[0]
    const limitDateStr = fiveDaysFromNow.toISOString().split('T')[0]

    // 3. Busca despesas que não estão pagas e que vencem em <= 5 dias
    const { data: expenses, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('type', 'expense')
      .in('status', ['Aguardando', 'Pendente']) 
      .lte('date', limitDateStr)

    if (error) throw error

    if (!expenses || expenses.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma despesa para alertar hoje." }), 
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // 4. Agrupa TODAS as dívidas (contexto familiar geral)
    const familyExpenses = { overdue: [], dueToday: [], upcoming: [] }
    
    expenses.forEach((exp) => {
      if (exp.date < todayStr) {
        familyExpenses.overdue.push(exp)
      } else if (exp.date === todayStr) {
        familyExpenses.dueToday.push(exp)
      } else {
        familyExpenses.upcoming.push(exp)
      }
    })

    // 5. Busca todos os usuários cadastrados no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    if (authError) throw authError
    
    const users = authData.users
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum usuário encontrado para enviar e-mail." }), 
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Verifica se as credenciais existem antes de tentar conectar
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
        throw new Error("Credenciais do Gmail não configuradas nos Secrets (GMAIL_USER e GMAIL_APP_PASSWORD)");
    }

    // 6. Configura o Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    // 7. Monta o e-mail geral
    const { overdue, dueToday, upcoming } = familyExpenses
    
    // Se não tiver nada pra receber (embora a query filtre <= 5, pode acontecer), ignoramos
    if (overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0) {
        return new Response(JSON.stringify({ message: "Nenhuma despesa no momento." }), { headers: { "Content-Type": "application/json" } })
    }

      // Template HTML Premium, Criativo e Moderno
      let htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Resumo de Despesas - Gestflow</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0fdfa; -webkit-font-smoothing: antialiased;">
          <!-- Fundo Decorativo -->
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f0fdfa 0%, #e0e7ff 100%); padding: 40px 15px;">
              <tr>
                  <td align="center">
                      <!-- Container Principal -->
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 30px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.08);">
                          
                          <!-- Header Criativo -->
                          <tr>
                              <td style="position: relative; background: linear-gradient(135deg, #4f46e5 0%, #7e22ce 100%); padding: 50px 30px; text-align: center;">
                                  <!-- Elementos Decorativos de Fundo (Simulados com tabelas) -->
                                  <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                                  <div style="position: absolute; bottom: -30px; left: -10px; width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                                  
                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                      <tr>
                                          <td align="center">
                                              <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); padding: 16px; border-radius: 20px; display: inline-block; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                                                  <img src="https://cdn-icons-png.flaticon.com/512/2950/2950536.png" alt="Gestflow Logo" width="54" height="54" style="display: block; filter: brightness(0) invert(1);" />
                                              </div>
                                          </td>
                                      </tr>
                                      <tr>
                                            <td align="center">
                                                <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Gestflow</h1>
                                                <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 16px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">Radar Financeiro da Família</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
  
                            <!-- Mensagem Inicial -->
                            <tr>
                                <td style="padding: 40px 30px 20px 30px; text-align: center;">
                                    <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 700;">Olá! 👋</h2>
                                    <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.6;">Aqui está o resumo geral das despesas de vocês para ajudar a manter tudo sob controle. Dá uma olhada:</p>
                                </td>
                            </tr>

                          <!-- Corpo do Email (Listas) -->
                          <tr>
                              <td style="padding: 20px 30px 40px 30px;">
      `;
      
      // BLOCO VENCIDAS (Atrasadas)
      if (overdue.length > 0) {
        htmlContent += `
                                  <!-- Cartão Vencidas -->
                                  <div style="background: linear-gradient(to right, #fff1f2, #ffe4e6); border: 1px solid #fecdd3; border-radius: 20px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(225, 29, 72, 0.05);">
                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                          <tr>
                                              <td style="padding-bottom: 20px; border-bottom: 2px dashed #fecdd3;">
                                                  <h3 style="color: #e11d48; margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                                                      <span style="font-size: 22px; vertical-align: middle; margin-right: 8px;">🚨</span> Atrasadas (Vencidas)
                                                  </h3>
                                              </td>
                                          </tr>
        `;
        
        overdue.forEach((exp) => {
          htmlContent += `
                                          <tr>
                                              <td style="padding: 16px 0 0 0;">
                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                      <tr>
                                                          <td width="70%">
                                                              <strong style="color: #881337; font-size: 16px; display: block; margin-bottom: 4px;">${exp.description}</strong>
                                                              <span style="color: #f43f5e; font-size: 13px; font-weight: 600; background: #fff1f2; padding: 4px 8px; border-radius: 6px;">Venceu em: ${exp.date.split('-').reverse().join('/')}</span>
                                                          </td>
                                                          <td width="30%" align="right" valign="middle">
                                                              <span style="color: #e11d48; font-weight: 800; font-size: 18px;">
                                                                  R$ ${exp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                              </span>
                                                          </td>
                                                      </tr>
                                                  </table>
                                              </td>
                                          </tr>
          `;
        });
        
        htmlContent += `
                                      </table>
                                  </div>
        `;
      }

      // BLOCO VENCEM HOJE
      if (dueToday.length > 0) {
        htmlContent += `
                                  <!-- Cartão Hoje -->
                                  <div style="background: linear-gradient(to right, #fffbeb, #fef3c7); border: 1px solid #fde68a; border-radius: 20px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.05);">
                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                          <tr>
                                              <td style="padding-bottom: 20px; border-bottom: 2px dashed #fde68a;">
                                                  <h3 style="color: #d97706; margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                                                      <span style="font-size: 22px; vertical-align: middle; margin-right: 8px;">🔥</span> Vencem Hoje
                                                  </h3>
                                              </td>
                                          </tr>
        `;
        
        dueToday.forEach((exp) => {
          htmlContent += `
                                          <tr>
                                              <td style="padding: 16px 0 0 0;">
                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                      <tr>
                                                          <td width="70%">
                                                              <strong style="color: #92400e; font-size: 16px; display: block; margin-bottom: 4px;">${exp.description}</strong>
                                                              <span style="color: #d97706; font-size: 13px; font-weight: 600; background: #fffbeb; padding: 4px 8px; border-radius: 6px;">Hoje</span>
                                                          </td>
                                                          <td width="30%" align="right" valign="middle">
                                                              <span style="color: #d97706; font-weight: 800; font-size: 18px;">
                                                                  R$ ${exp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                              </span>
                                                          </td>
                                                      </tr>
                                                  </table>
                                              </td>
                                          </tr>
          `;
        });
        
        htmlContent += `
                                      </table>
                                  </div>
        `;
      }

      // BLOCO PRÓXIMAS (A vencer)
      if (upcoming.length > 0) {
        htmlContent += `
                                  <!-- Cartão A Vencer -->
                                  <div style="background: linear-gradient(to right, #eff6ff, #dbeafe); border: 1px solid #bfdbfe; border-radius: 20px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.05);">
                                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                          <tr>
                                              <td style="padding-bottom: 20px; border-bottom: 2px dashed #bfdbfe;">
                                                  <h3 style="color: #2563eb; margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                                                      <span style="font-size: 22px; vertical-align: middle; margin-right: 8px;">📅</span> Próximos 5 Dias
                                                  </h3>
                                              </td>
                                          </tr>
        `;
        
        upcoming.forEach((exp) => {
          htmlContent += `
                                          <tr>
                                              <td style="padding: 16px 0 0 0;">
                                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                      <tr>
                                                          <td width="70%">
                                                              <strong style="color: #1e3a8a; font-size: 16px; display: block; margin-bottom: 4px;">${exp.description}</strong>
                                                              <span style="color: #3b82f6; font-size: 13px; font-weight: 600; background: #eff6ff; padding: 4px 8px; border-radius: 6px;">Vence em: ${exp.date.split('-').reverse().join('/')}</span>
                                                          </td>
                                                          <td width="30%" align="right" valign="middle">
                                                              <span style="color: #2563eb; font-weight: 800; font-size: 18px;">
                                                                  R$ ${exp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                              </span>
                                                          </td>
                                                      </tr>
                                                  </table>
                                              </td>
                                          </tr>
          `;
        });
        
        htmlContent += `
                                      </table>
                                  </div>
        `;
      }
      
      htmlContent += `
                                  <!-- Botão de Ação Mágico -->
                                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px;">
                                      <tr>
                                          <td align="center">
                                              <a href="#" style="background: linear-gradient(135deg, #4f46e5 0%, #7e22ce 100%); color: #ffffff; text-decoration: none; padding: 18px 40px; border-radius: 100px; font-weight: 800; font-size: 16px; display: inline-block; box-shadow: 0 10px 20px rgba(126, 34, 206, 0.3); text-transform: uppercase; letter-spacing: 1px; transition: all 0.3s ease;">
                                                  Abrir App Gestflow
                                              </a>
                                          </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>

                          <!-- Footer Minimalista -->
                          <tr>
                              <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                  <img src="https://cdn-icons-png.flaticon.com/512/2950/2950536.png" alt="Gestflow Logo" width="32" height="32" style="display: inline-block; filter: grayscale(100%) opacity(40%); margin-bottom: 12px;" />
                                  <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                                      Este é um e-mail automático do <strong>Gestflow</strong>.<br>
                                      Organize as finanças da família com tranquilidade e estilo. 💜
                                  </p>
                              </td>
                          </tr>
                      </table>
                      
                      <!-- Espaço extra no final -->
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr><td height="20"></td></tr>
                      </table>
                  </td>
              </tr>
          </table>
      </body>
      </html>
      `;

      // Definir assunto inteligente
      let subject = '📅 Resumo Financeiro - Gestflow';
      if (overdue.length > 0) {
          subject = '🚨 URGENTE: Você tem despesas atrasadas!';
      } else if (dueToday.length > 0) {
          subject = '🔥 Atenção: Despesas vencendo HOJE!';
      } else if (upcoming.length > 0) {
          subject = '📅 Prepare-se: Despesas nos próximos dias';
      }

      // 8. Envia o mesmo email para todos os usuários cadastrados
      for (const user of users) {
        const email = user.email;
        if (!email) continue;
        
        await transporter.sendMail({
          from: `"Gestflow" <${GMAIL_USER}>`,
          to: email,
          subject: subject,
          html: htmlContent,
        });
      }

    return new Response(JSON.stringify({ message: "Emails processados e enviados via Gmail (Nodemailer)!" }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})