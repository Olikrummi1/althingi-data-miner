
import { DatabaseExplorer } from "@/components/database/DatabaseExplorer";
import Header from "@/components/Header";

const DatabasePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-6 px-4">
        <DatabaseExplorer />
      </main>
    </div>
  );
};

export default DatabasePage;
