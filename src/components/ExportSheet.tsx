import { useToast } from '../hooks/useToast';
import { canShareFile, downloadFile, formatSize, shareFile, type ExportFile } from '../lib/export/share';
import { Icon, IconChip } from './Icon';
import { Sheet } from './Sheet';

/**
 * Archivo listo para compartir. El botón "Compartir" llama a navigator.share en el mismo
 * toque del usuario (requisito de iOS), por eso el archivo se genera antes de mostrar esta hoja.
 */
export function ExportSheet({ file, title, onClose }: { file: ExportFile; title: string; onClose: () => void }) {
  const toast = useToast();
  const shareable = canShareFile(file);
  const isPdf = file.name.endsWith('.pdf');

  return (
    <Sheet onClose={onClose} small label={title}>
      {({ close, dragProps }) => (
        <>
          <div className="panel-head draggable" {...dragProps}>
            <div className="panel-title">
              <span>{title}</span>
            </div>
            <button className="icon-btn close" aria-label="Cerrar" onClick={close}>
              <Icon name="x" />
            </button>
          </div>
          <div className="dialog-body">
            <div className="file-card">
              <IconChip name={isPdf ? 'chart' : 'download'} size="md" />
              <span className="fn">{file.name}</span>
              <span className="sz">{formatSize(file.blob.size)}</span>
            </div>
          </div>
          <div className="dialog-actions">
            <button
              className={`btn ${shareable ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => {
                downloadFile(file);
                if (!shareable) close();
              }}
            >
              <Icon name="download" size={18} />
              Descargar
            </button>
            {shareable && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  shareFile(file, title).then(
                    (done) => done && close(),
                    () => toast('No se pudo compartir'),
                  );
                }}
              >
                <Icon name="share" size={18} />
                Compartir
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
