import { useEffect, useState } from 'react';
import type { DocumentTemplate } from '../../domain/template/documentTemplate';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '../../domain/template/documentTemplate';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from '../../features/admin/AdminLayout';
import { useServices } from '../../hooks/useServices';
import { ResponsiveTable, type ResponsiveTableColumn } from '../ui/ResponsiveTable';
import { StatusBadge } from '../ui/StatusBadge';
import styles from '../../features/admin/AdminLayout.module.css';

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

  const columns: ResponsiveTableColumn<DocumentTemplate>[] = [
    { id: 'name', header: 'Name', render: (template) => template.name },
    { id: 'type', header: 'Typ', render: (template) => DOCUMENT_TEMPLATE_TYPE_LABELS[template.type] },
    { id: 'version', header: 'Version', render: (template) => template.versionNumber, numeric: true },
    {
      id: 'status',
      header: 'Status',
      render: (template) => (
        <StatusBadge
          variant={template.status === 'active' ? 'success' : 'neutral'}
          label={template.status === 'active' ? 'Aktiv' : template.status}
        />
      ),
    },
  ];

  return (
    <AdminLayout title="Vorlagen">
      {templates.length === 0 ? (
        <EmptyState title="Keine Vorlagen" description="Es sind keine Vorlagen vorhanden." />
      ) : (
        <>
          <ResponsiveTable
            ariaLabel="Vorlagenliste"
            columns={columns}
            rows={templates}
            rowKey={(template) => template.id}
          />
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
