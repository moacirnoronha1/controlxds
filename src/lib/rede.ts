/**
 * Proteções para chamadas ao banco feitas pelos formulários de cadastro/entrada.
 *
 * Uma requisição que nunca responde (rede instável, aba que ficou em segundo
 * plano, renovação de sessão travada) deixava o botão em "Registrando..."
 * para sempre. Aqui toda chamada ganha um tempo limite: ao estourar, a
 * requisição é cancelada e o formulário recebe um erro claro para tentar de novo.
 */

export const TEMPO_LIMITE_PADRAO_MS = 20_000;

export class TempoEsgotadoError extends Error {
  constructor() {
    super(
      "O servidor demorou para responder. Seus dados foram mantidos — toque em registrar novamente (não haverá duplicidade).",
    );
    this.name = "TempoEsgotadoError";
  }
}

/**
 * Executa `fn` com um AbortSignal e rejeita após `ms` milissegundos, mesmo que a
 * chamada interna não respeite o cancelamento.
 */
export async function comTempoLimite<T>(
  fn: (signal: AbortSignal) => PromiseLike<T>,
  ms = TEMPO_LIMITE_PADRAO_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TempoEsgotadoError());
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve(fn(controller.signal)), limite]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ErroLike = { message?: string; code?: string; details?: string; name?: string };

/** Traduz erros técnicos do banco/rede para mensagens claras ao usuário. */
export function mensagemErro(e: unknown): string {
  const err = (e ?? {}) as ErroLike;
  const msg = String(err.message ?? e ?? "");
  if (e instanceof TempoEsgotadoError) return e.message;
  if (err.name === "AbortError" || /abort/i.test(msg)) {
    return new TempoEsgotadoError().message;
  }
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return "Sem conexão com o servidor. Verifique a internet e tente novamente — seus dados foram mantidos.";
  }
  if (err.code === "23505" || /duplicate key/i.test(msg)) {
    if (/codigo_barras/i.test(msg)) return "Já existe um produto com este código de barras.";
    if (/codigo_caixa/i.test(msg)) return "Já existe um produto com este código de caixa.";
    return "Este registro já existe.";
  }
  if (err.code === "42501" || /permission denied|row-level security/i.test(msg)) {
    return "Sem permissão para esta ação. Saia e entre novamente no sistema.";
  }
  if (/jwt expired|invalid jwt|not authenticated/i.test(msg)) {
    return "Sua sessão expirou. Saia e entre novamente no sistema.";
  }
  return msg || "Não foi possível concluir. Tente novamente.";
}
