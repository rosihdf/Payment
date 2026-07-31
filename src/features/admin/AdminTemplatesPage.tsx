import { useEffect, useState } from 'react';
import type { DocumentTemplate } from '../../domain/template/documentTemplate';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '../../domain/template/documentTemplate';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import styles from './AdminLayout.module.css';

export function AdminTemplatesPage() {
  const context = useAdminContext();
  const { documentTemplateService } = useServices();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    if (!context) {
      return;
    }
    void documentTemplateService.getTemplates(context).then((result) => {
      if (Array.isArray(result) && result[0]) {
        setTemplates(result);
        setPreview(documentTemplateService.previewTemplate(result[0]));
      }
    });
  }, [context, documentTemplateService]);

  return (
    <AdminLayout title="Vorlagen">
      {templates.length === 0 ? (
        <EmptyState title="Keine Vorlagen" description="Es sind keine Vorlagen vorhanden." />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Typ</th>
                  <th>Version</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.name}</td>
                    <td>{DOCUMENT_TEMPLATE_TYPE_LABELS[template.type]}</td>
                    <td>{template.versionNumber}</td>
                    <td>{template.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview ? (
            <section className={styles.panel}>
              <h2>Vorschau (Demodaten)</h2>
              <pre>{preview}</pre>
            </section>
          ) : null}
        </>
      )}
    </AdminLayout>
  );
}
