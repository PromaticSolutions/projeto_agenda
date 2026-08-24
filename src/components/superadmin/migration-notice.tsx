import { Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * As migrações deste projeto são aplicadas à mão no SQL Editor do Supabase
 * (ver README.md), então o código de uma feature pode chegar antes do SQL
 * dela. Quando isso acontece, a tela diz o que fazer em vez de estourar no
 * error boundary — e o resto do painel continua funcionando.
 */
export function MigrationNotice({
  migration,
  feature,
}: {
  migration: string;
  feature: string;
}) {
  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Database className="size-4 text-primary" />
      <AlertTitle>{feature} ainda não existe no banco</AlertTitle>
      <AlertDescription>
        <p>
          Rode <code>supabase/migrations/{migration}</code> no SQL Editor do projeto Supabase e
          recarregue esta página. Nenhum outro módulo do painel depende disso.
        </p>
      </AlertDescription>
    </Alert>
  );
}
