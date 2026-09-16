import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useOfflineSync } from "./hooks/useOfflineSync";
import AppLayout from "./components/layout/AppLayout";
import Index from "./pages/Index";
import FeedbackDetail from "./pages/FeedbackDetail";
import Configuracoes from "./pages/Configuracoes";
import Desempenho from "./pages/Desempenho";
import AutoAvaliacaoFit from "./pages/AutoAvaliacaoFit";
import AutoAvaliacaoPotencial from "./pages/AutoAvaliacaoPotencial";
import Admin from "./pages/Admin";
import CadastroMetas from "./pages/CadastroMetas";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import FuncionarioProfile from "./pages/FuncionarioProfile";
import Eventos from "./pages/Eventos";
import Ausencias from "./pages/Ausencias";
import Colaboradores from "./pages/Colaboradores";
import Organograma from "./pages/Organograma";
import Sucessao from "./pages/Sucessao";
import EvolucaoContrato from "./pages/EvolucaoContrato";
import GestaoNotificacoes from "./pages/GestaoNotificacoes";
import DiscTest from "./pages/DiscTest";
import Treinamentos from "./pages/Treinamentos";
import AssessmentHub from "./pages/AssessmentHub";
import CCO from "./pages/CCO";
import { InstallPWA } from './components/InstallPWA';
import { PWAUpdateHandler } from './components/PWAUpdateHandler';
import { PageGuard } from "./components/auth/PageGuard";

class ErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean; errorId: string; errorMessage: string; errorStack: string }> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, errorId: '', errorMessage: '', errorStack: '' };
  }
  static getDerivedStateFromError(error: Error) {
    const errorId = Math.random().toString(36).substring(2, 8).toUpperCase();
    return { hasError: true, errorId, errorMessage: error?.message || String(error), errorStack: error?.stack || '' };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log do erro para debugging — NÃO exposto ao usuário
    console.error('[ErrorBoundary] Erro capturado:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-2xl p-8">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-foreground">Algo deu errado</h1>
            <p className="text-muted-foreground text-sm">
              Ocorreu um erro inesperado. Por favor, tire um print dessa tela e envie para o suporte.
            </p>
            <div className="bg-destructive/10 text-destructive text-left p-4 rounded-md overflow-auto max-h-48 text-xs font-mono">
              <p className="font-bold mb-1">Error: {this.state.errorMessage}</p>
              <pre className="whitespace-pre-wrap">{this.state.errorStack}</pre>
            </div>
            <p className="text-xs text-muted-foreground font-mono">Código: {this.state.errorId}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutos — não refetch desnecessário
      gcTime: 1000 * 60 * 10,          // 10 minutos de cache
      refetchOnWindowFocus: false,      // Não refetch ao focar a janela
      retry: 1,                         // Apenas 1 retry em caso de erro
    },
  },
});

// Protege rotas que exigem perfil de administrador
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  
  useOfflineSync();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<PageGuard pageKey="dashboard"><Index /></PageGuard>} />
          <Route path="/colaboradores" element={<PageGuard pageKey="colaboradores"><Colaboradores /></PageGuard>} />
          <Route path="/cadastro" element={<Navigate to="/colaboradores" replace />} />
          <Route path="/feedbacks" element={<Navigate to="/desempenho?tab=feedbacks" replace />} />
          <Route path="/feedbacks/:id" element={<PageGuard pageKey="desempenho"><FeedbackDetail /></PageGuard>} />
          <Route path="/novo" element={<Navigate to="/desempenho?tab=feedbacks" replace />} />
          <Route path="/configuracoes" element={<PageGuard pageKey="configuracoes"><Configuracoes /></PageGuard>} />
          <Route path="/desempenho" element={<PageGuard pageKey="desempenho"><Desempenho /></PageGuard>} />
          <Route path="/desempenho/avaliacoes" element={<Navigate to="/desempenho?tab=metas" replace />} />
          <Route path="/desempenho/competencias" element={<Navigate to="/desempenho?tab=fit-cultural" replace />} />
          <Route path="/desempenho/pdi" element={<Navigate to="/desempenho?tab=pdi" replace />} />
          <Route path="/funcionario/:id" element={<PageGuard pageKey="colaboradores"><FuncionarioProfile /></PageGuard>} />
          <Route path="/eventos" element={<PageGuard pageKey="eventos"><Eventos /></PageGuard>} />
          <Route path="/ausencias" element={<PageGuard pageKey="ausencias"><Ausencias /></PageGuard>} />
          <Route path="/organograma" element={<PageGuard pageKey="organograma"><Organograma /></PageGuard>} />
          <Route path="/sucessao" element={<Navigate to="/desempenho?tab=sucessao" replace />} />
          <Route path="/evolucao" element={<PageGuard pageKey="evolucao"><EvolucaoContrato /></PageGuard>} />
          <Route path="/cadastro-metas" element={<PageGuard pageKey="desempenho"><CadastroMetas /></PageGuard>} />
          <Route path="/notificacoes" element={<PageGuard pageKey="notificacoes"><GestaoNotificacoes /></PageGuard>} />
          <Route path="/treinamentos" element={<PageGuard pageKey="treinamentos"><Treinamentos /></PageGuard>} />
          <Route path="/assessments" element={<PageGuard pageKey="treinamentos"><AssessmentHub /></PageGuard>} />
          <Route path="/cco" element={<CCO />} />
          {/* Legacy compat */}
          <Route path="/disc" element={<PageGuard pageKey="disc"><DiscTest /></PageGuard>} />
          <Route path="/disc/:id" element={<PageGuard pageKey="disc"><DiscTest /></PageGuard>} />

          <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPWA />
      <PWAUpdateHandler />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/autoavaliacao-fit-cultural" element={<AutoAvaliacaoFit />} />
            <Route path="/autoavaliacao-potencial" element={<AutoAvaliacaoPotencial />} />
            <Route path="/assessment/:type" element={<AssessmentHub />} />
            <Route path="/assessment/:type/:id" element={<AssessmentHub />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
