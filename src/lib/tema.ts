export type Tema = 'dark' | 'light'

/**
 * Tema antes de haver usuário.
 *
 * O tema "de verdade" vem da config da conta, mas ela só chega depois do
 * login — e a tela de login precisa de um tema agora. Sem isso ela abria
 * sempre no claro, mesmo pra quem usa o app no escuro, porque o atributo que
 * pinta a interface só era escrito quando os dados carregavam.
 *
 * localStorage, e não o arquivo de sessão: é preferência de aparência, não
 * segredo, e precisa estar disponível no primeiro quadro da tela — ler por
 * IPC deixaria o app piscar no tema errado antes de corrigir.
 */
const CHAVE = 'financas:tema'

export const temaGuardado = (): Tema => {
  try {
    const v = localStorage.getItem(CHAVE)
    if (v === 'dark' || v === 'light') return v
  } catch {
    // Modo privado ou storage bloqueado: segue no padrão.
  }
  return 'dark'
}

export const aplicarTema = (t: Tema): void => {
  document.documentElement.dataset.tema = t
  try {
    localStorage.setItem(CHAVE, t)
  } catch {
    /* sem persistência, mas a tela já está pintada */
  }
  // A barra de título é nativa: sem avisar o processo principal, ela fica
  // clara com o app escuro.
  void window.bolso?.janela?.tema?.(t)
}

/** Chamado no arranque, antes de qualquer tela decidir o que mostrar. */
export const aplicarTemaInicial = (): Tema => {
  const t = temaGuardado()
  aplicarTema(t)
  return t
}
