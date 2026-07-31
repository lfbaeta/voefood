import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { consumeSessionFromHash } from "./lib/crossDomainAuth";

// Aplica a sessão vinda por hash (superadmin/revendedor acessando o painel de
// um estabelecimento em outro subdomínio) ANTES de renderizar as rotas,
// evitando qualquer tela de login intermediária.
consumeSessionFromHash()
  .catch(() => undefined)
  .finally(() => {
    createRoot(document.getElementById("root")!).render(<App />);
  });
