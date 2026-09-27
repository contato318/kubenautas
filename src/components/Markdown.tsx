import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-k8s">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Tabelas largas rolam dentro do próprio contêiner, sem alargar a página no celular
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
