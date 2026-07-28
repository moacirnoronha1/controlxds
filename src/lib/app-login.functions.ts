import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type LoginInput = { username: string; senha: string };

/**
 * Valida o login próprio (tabela `usuarios`) e devolve, além dos dados do
 * usuário, uma sessão real do backend para que as consultas do app rodem
 * como `authenticated` (as tabelas operacionais exigem autenticação).
 */
export const loginComSessao = createServerFn({ method: "POST" })
  .inputValidator((d: LoginInput) => ({
    username: String(d?.username ?? "").trim(),
    senha: String(d?.senha ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!data.username || !data.senha) throw new Error("Informe usuário e senha.");

    const url = process.env.SUPABASE_URL!;
    const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const authOpts = {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    } as const;

    const pub = createClient(url, publishable, authOpts);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc("login_usuario" as never, {
      _username: data.username,
      _senha: data.senha,
    } as never);
    if (error) throw new Error(error.message);
    const row = (Array.isArray(rows) ? rows[0] : null) as
      | { id: string; nome: string; username: string; cargo: string; setor: string | null; token?: string }
      | null;
    if (!row?.id) throw new Error("Usuário ou senha inválidos, ou usuário inativo.");


    const email = `${row.username.toLowerCase().replace(/[^a-z0-9._-]/g, "")}@gxcontrol.local`;
    const tempPassword = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8);

    const { data: link } = await supabaseAdmin
      .from("usuarios")
      .select("auth_user_id")
      .eq("id", row.id)
      .maybeSingle();

    let authUserId = (link as { auth_user_id: string | null } | null)?.auth_user_id ?? null;

    if (authUserId) {
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (upErr) authUserId = null;
    }

    if (!authUserId) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nome: row.nome, cargo: row.cargo },
      });
      if (created?.user?.id) {
        authUserId = created.user.id;
      } else {
        // e-mail já existe: localiza a conta e redefine a senha
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
        if (!found) throw new Error(createErr?.message ?? "Falha ao preparar a sessão.");
        authUserId = found.id;
        const { error: upErr2 } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: tempPassword,
          email_confirm: true,
        });
        if (upErr2) throw new Error(upErr2.message);
      }
      await supabaseAdmin.from("usuarios").update({ auth_user_id: authUserId }).eq("id", row.id);
    }

    const { data: signed, error: signErr } = await pub.auth.signInWithPassword({
      email,
      password: tempPassword,
    });
    if (signErr || !signed?.session) throw new Error(signErr?.message ?? "Falha ao iniciar sessão.");

    return {
      user: row,
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
    };
  });
