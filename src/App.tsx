import { useState } from 'react'
import { Shell, type Tela } from './components/Shell'
import { useDados } from './lib/estado'
import { AvisoVersao, BloqueioVersao, useVersao } from '@/components/Versao'
import { nomeMes } from './lib/mes'
import { Painel } from './pages/Painel'
import { Cartoes } from './pages/Cartoes'
import { Compras } from './pages/Compras'
import { Faturas } from './pages/Faturas'
import { Ganhos } from './pages/Ganhos'
import { Fixos } from './pages/Fixos'
import { Ajustes } from './pages/Ajustes'
import { PerfilPage } from './pages/Perfil'
import { FamiliaPage } from './pages/Familia'
import { AvisoAtualizacao } from './components/AvisoAtualizacao'
import { Entrar } from './pages/Entrar'
import { useAutenticacao } from './lib/auth'

const TITULOS: Record<Tela, string> = {
  painel: 'Painel',
  cartoes: 'Cartões',
  compras: 'Compras',
  faturas: 'Faturas',
  ganhos: 'Ganhos',
  fixos: 'Gastos',
  perfil: 'Meu perfil',
  familia: 'Família',
  ajustes: 'Ajustes',
}

/** Telas em que o mês de referência não muda nada. */
const SEM_MES: Tela[] = ['perfil', 'familia', 'ajustes']

export function App() {
  const { usuario, carregando: verificandoSessao } = useAutenticacao()
  const [tela, setTela] = useState<Tela>('painel')
  /** Atalho do painel: cai em compras já com o leitor de print aberto. */
  const [lerPrint, setLerPrint] = useState(false)

  const irPara = (t: Tela) => {
    setLerPrint(false)
    setTela(t)
  }
  const { carregando, mes, filtro, membros } = useDados()

  // Enquanto a sessão guardada é lida do disco, nada é decidido: mostrar a
  // tela de login aqui faria ela piscar em toda abertura de quem já está
  // conectado.
  if (verificandoSessao) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="size-7 animate-spin rounded-full border-2 border-linha border-t-marca" />
      </div>
    )
  }

  if (!usuario) return <Entrar />

  if (carregando) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="size-7 animate-spin rounded-full border-2 border-linha border-t-marca" />
          <span className="text-xs text-tinta-fraca">Abrindo seus dados…</span>
        </div>
      </div>
    )
  }

  // Quem está em foco vira subtítulo. Sem família, não há o que somar e a
  // linha some.
  const visao =
    !filtro || filtro.length === 0
      ? null
      : membros
          .filter((m) => filtro.includes(m.id))
          .map((m) => m.nome.split(' ')[0])
          .join(' + ')

  const subtitulo = SEM_MES.includes(tela)
    ? undefined
    : [nomeMes(mes), visao].filter(Boolean).join(' · ')

  return (
    <Shell
      tela={tela}
      irPara={irPara}
      titulo={TITULOS[tela]}
      subtitulo={subtitulo}
      mostrarMes={!SEM_MES.includes(tela)}
    >
      {tela === 'painel' && (
        <Painel
          irPara={irPara}
          onLerPrint={() => {
            setTela('compras')
            setLerPrint(true)
          }}
        />
      )}
      {tela === 'cartoes' && <Cartoes />}
      {tela === 'compras' && <Compras irPara={irPara} abrirLeitor={lerPrint} />}
      {tela === 'faturas' && <Faturas />}
      {tela === 'ganhos' && <Ganhos />}
      {tela === 'fixos' && <Fixos />}
      {tela === 'perfil' && <PerfilPage />}
      {tela === 'familia' && <FamiliaPage />}
      {tela === 'ajustes' && <Ajustes />}
      <AvisoAtualizacao />
    </Shell>
  )
}
