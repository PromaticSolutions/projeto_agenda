import { cn } from "@/lib/utils";

export interface ChartTableData {
  columns: string[];
  rows: string[][];
}

/**
 * Moldura de gráfico: título, subtítulo, o gráfico e — sempre — a tabela com
 * os mesmos números atrás de um `<details>`.
 *
 * A tabela não é enfeite: gráfico é a única parte do painel em que o valor
 * mora numa posição, e não num texto. Sem a tabela, quem usa leitor de tela ou
 * não consegue passar o mouse (toque, teclado, impressão) perde o dado. Ela
 * fica fechada por padrão para não competir com o gráfico.
 */
export function ChartCard({
  title,
  subtitle,
  data,
  footer,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  data?: ChartTableData;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("panel flex flex-col gap-3 p-4", className)}>
      <div>
        <p className="section-label">{title}</p>
        {subtitle && <p className="mt-0.5 text-sm text-foreground">{subtitle}</p>}
      </div>

      <div className="min-w-0">{children}</div>

      {footer}

      {data && data.rows.length > 0 && (
        <details className="group">
          <summary className="w-fit cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Ver dados em tabela
          </summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {data.columns.map((column, i) => (
                    <th
                      key={column}
                      className={cn(
                        "px-2.5 py-1.5 font-medium text-muted-foreground",
                        i > 0 && "text-right"
                      )}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-2.5 py-1.5",
                          i === 0 ? "text-muted-foreground" : "text-right tabular-nums text-foreground"
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
