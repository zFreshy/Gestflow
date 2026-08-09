// Cria a conta de um funcionario.
//
// Existe como Edge Function por um motivo unico: criar usuario exige a
// service_role key, que da poder total sobre o banco. Ela nao pode viajar
// dentro de um app que o cliente instala na maquina dele — bastaria abrir o
// executavel para extrai-la. Aqui a chave fica no servidor, e o app so chama.
//
// Quem pode chamar: apenas administrador. A checagem usa o token de quem
// chamou contra a funcao is_admin() do banco — nao confia em nada que venha
// no corpo da requisicao.
//
// Deploy:
//   supabase functions deploy create-employee

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });

/** "João da Silva" -> "joao.da.silva@funcionario.local" */
function loginEmailFor(name: string): string {
    const slug = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '');

    return `${slug}@funcionario.local`;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return json({ error: 'Sem autenticação.' }, 401);

        const url = Deno.env.get('SUPABASE_URL')!;

        // Cliente com o token de QUEM CHAMOU, para descobrir se é admin.
        const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: isAdmin, error: roleError } = await caller.rpc('is_admin');
        if (roleError) return json({ error: 'Não consegui verificar a permissão.' }, 500);
        if (isAdmin !== true) {
            return json({ error: 'Só o administrador pode criar funcionários.' }, 403);
        }

        const { name, password } = await req.json();

        if (!name || typeof name !== 'string' || !name.trim()) {
            return json({ error: 'O nome é obrigatório.' }, 400);
        }
        // O Supabase exige 6+; avisar aqui evita um erro cru na tela.
        if (!password || typeof password !== 'string' || password.length < 6) {
            return json({ error: 'A senha precisa de pelo menos 6 caracteres.' }, 400);
        }

        const cleanName = name.trim();
        const email = loginEmailFor(cleanName);

        // A partir daqui, poderes de administrador do projeto.
        const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const { data: created, error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            // Confirmado na hora: o e-mail é sintético, ninguém recebe nada nele.
            email_confirm: true,
            user_metadata: { employee_name: cleanName },
        });

        if (createError || !created?.user) {
            const already = createError?.message?.toLowerCase().includes('already');
            return json(
                { error: already ? 'Já existe um funcionário com esse nome.' : 'Não consegui criar a conta.' },
                already ? 409 : 500,
            );
        }

        const { data: profile, error: profileError } = await admin
            .from('employee_profiles')
            .insert({
                user_id: created.user.id,
                name: cleanName,
                login_email: email,
            })
            .select('id, name, active')
            .single();

        if (profileError) {
            // Sem o perfil, a conta ficaria orfa: existiria no auth mas o app
            // nao a reconheceria como funcionario — e ela seria tratada como
            // ADMIN, que e exatamente o oposto do pretendido.
            await admin.auth.admin.deleteUser(created.user.id);
            const dup = profileError.code === '23505';
            return json(
                { error: dup ? 'Já existe um funcionário com esse nome.' : 'Não consegui criar o perfil.' },
                dup ? 409 : 500,
            );
        }

        return json({ profile });
    } catch (err) {
        console.error(err);
        return json({ error: 'Erro inesperado.' }, 500);
    }
});
