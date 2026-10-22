import { contextBridge, ipcRenderer } from 'electron'
import type { EstadoAtualizacao } from './atualizador'
import type { EstadoSincronizacao } from './sincronizacao'

/** Única superfície que o renderer vê do processo principal. */
const api = {
  dados: {
    ler: (usuarioId?: string) => ipcRenderer.invoke('dados:ler', usuarioId),
    gravar: (dados: unknown, usuarioId?: string) => ipcRenderer.invoke('dados:gravar', dados, usuarioId),
    caminho: () => ipcRenderer.invoke('dados:caminho'),
    revelar: () => ipcRenderer.invoke('dados:revelar'),
    exportar: (dados: unknown) => ipcRenderer.invoke('dados:exportar', dados),
    importar: () => ipcRenderer.invoke('dados:importar'),
    /** Dispara quando a sincronização traz dados de outra máquina; devolve a
     *  função que cancela a escuta. */
    aoChegarDeFora: (fn: (dados: unknown) => void) => {
      const ouvinte = (_e: unknown, dados: unknown) => fn(dados)
      ipcRenderer.on('dados:externos', ouvinte)
      return () => {
        ipcRenderer.off('dados:externos', ouvinte)
      }
    },
  },
  sincronizacao: {
    estado: (): Promise<EstadoSincronizacao> => ipcRenderer.invoke('sincronizacao:estado'),
    agora: (): Promise<EstadoSincronizacao> => ipcRenderer.invoke('sincronizacao:agora'),
    /** Devolve a função que cancela a escuta. */
    aoMudar: (fn: (e: EstadoSincronizacao) => void) => {
      const ouvinte = (_e: unknown, estado: EstadoSincronizacao) => fn(estado)
      ipcRenderer.on('sincronizacao:estado', ouvinte)
      return () => {
        ipcRenderer.off('sincronizacao:estado', ouvinte)
      }
    },
  },
  ocr: {
    reconhecer: (dataUrl: string) => ipcRenderer.invoke('ocr:reconhecer', dataUrl),
    escolherImagem: () => ipcRenderer.invoke('ocr:escolherImagem'),
  },
  sessao: {
    ler: () => ipcRenderer.invoke('sessao:ler'),
    gravar: (s: unknown) => ipcRenderer.invoke('sessao:gravar', s),
    apagar: () => ipcRenderer.invoke('sessao:apagar'),
  },
  janela: {
    tema: (tema: 'dark' | 'light') => ipcRenderer.invoke('janela:tema', tema),
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
  },
  atualizacao: {
    estado: (): Promise<EstadoAtualizacao> => ipcRenderer.invoke('atualizacao:estado'),
    verificar: (): Promise<EstadoAtualizacao> => ipcRenderer.invoke('atualizacao:verificar'),
    instalar: (): Promise<boolean> => ipcRenderer.invoke('atualizacao:instalar'),
    /** Devolve a função que cancela a escuta. */
    aoMudar: (fn: (e: EstadoAtualizacao) => void) => {
      const ouvinte = (_e: unknown, estado: EstadoAtualizacao) => fn(estado)
      ipcRenderer.on('atualizacao:estado', ouvinte)
      return () => {
        ipcRenderer.off('atualizacao:estado', ouvinte)
      }
    },
  },
}

contextBridge.exposeInMainWorld('bolso', api)

export type ApiBolso = typeof api
