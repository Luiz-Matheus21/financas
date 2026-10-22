import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import { App } from './App'
import { ProvedorDados } from './lib/estado'
import { ProvedorAutenticacao } from './lib/auth'
import { aplicarTemaInicial } from './lib/tema'

// Antes do render: senão a tela de login pisca no claro até os dados da
// conta chegarem com o tema de verdade.
aplicarTemaInicial()

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    {/* Autenticação por fora: os dados só fazem sentido depois de saber
        quem está logado. */}
    <ProvedorAutenticacao>
      <ProvedorDados>
        <App />
      </ProvedorDados>
    </ProvedorAutenticacao>
  </StrictMode>,
)
