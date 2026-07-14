import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { ScrollToTop } from "@/components/ScrollToTop";

import { LoginModal } from "@/components/LoginModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Topics from "./pages/Topics";
import Speakers from "./pages/Speakers";
import Types from "./pages/Types";
import Sources from "./pages/Sources";
import TranscriptDetail from "./pages/TranscriptDetail";
import ConferenceArchive from "./pages/ConferenceArchive";
import Library from "./pages/Library";
import Audiobooks from "./pages/Audiobooks";
import LearningPath from "./pages/LearningPath";
import About from "./pages/About";
import SearchResults from "./pages/SearchResults";
import AudioGeneration from "./pages/AudioGeneration";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/categories" element={<Topics />} />
              <Route path="/topics" element={<Topics />} />
              <Route path="/speakers" element={<Speakers />} />
              <Route path="/types" element={<Types />} />
              <Route path="/sources" element={<Sources />} />
              <Route path="/transcript/:id" element={<TranscriptDetail />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/conferences" element={<ConferenceArchive />} />
              <Route path="/library" element={<Library />} />
              <Route path="/audiobooks" element={<Audiobooks />} />
              <Route path="/learning-path/:id" element={<LearningPath />} />
              <Route path="/about" element={<About />} />
              
              {/* Protected Routes */}
              <Route 
                path="/audio" 
                element={
                  <ProtectedRoute>
                    <AudioGeneration />
                  </ProtectedRoute>
                } 
              />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
          <LoginModal />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
