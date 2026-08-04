import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { CreateProductInput } from '../../domain/product/product';
import { productToFormInput, isSameProductInput } from '../../domain/product/productFormMapping';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateProductErrors } from '../../services/productValidation';
import { AdminLayout } from '../admin/AdminLayout';
import { Dialog } from '../../v2/ui/Dialog';
import { ProductForm } from './ProductForm';

export function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { productService } = useServices();
  const { showToast } = useToast();

  const [initialValues, setInitialValues] = useState<CreateProductInput | null>(null);
  const [values, setValues] = useState<CreateProductInput | null>(null);
  const [errors, setErrors] = useState<CreateProductErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    void productService.getProductById(id).then((product) => {
      if (product) {
        const formInput = productToFormInput(product);
        setInitialValues(formInput);
        setValues(formInput);
      }
      setIsLoading(false);
    });
  }, [id, productService]);

  const isDirty = initialValues && values ? !isSameProductInput(values, initialValues) : false;
  useBeforeUnload(Boolean(isDirty && !allowLeave));

  const leaveToOverview = () => {
    setAllowLeave(true);
    navigate('/admin/catalog?tab=products', { replace: true });
  };

  const handleSubmit = () => {
    if (isSubmitting || !currentUser || !id || !values) {
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setErrors({});
      const result = await productService.updateProduct(id, values, { role: currentUser.role });

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
        } else if (result.error === 'not_found') {
          showToast('Produkt wurde nicht gefunden', 'error');
        } else {
          showToast('Produkt konnte nicht gespeichert werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      showToast('Produkt wurde gespeichert', 'success');
      leaveToOverview();
    })();
  };

  if (isLoading) {
    return (
      <AdminLayout title="Produkt bearbeiten">
        <EmptyState title="Produkt wird geladen" description="Die Produktdaten werden abgerufen." />
      </AdminLayout>
    );
  }

  if (!values) {
    return (
      <AdminLayout title="Produkt bearbeiten">
        <EmptyState
          title="Produkt nicht gefunden"
          description="Das angeforderte Produkt existiert nicht oder wurde entfernt."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Produkt bearbeiten" subtitle="BestPay-Produkt aktualisieren">
      <ProductForm
        mode="edit"
        values={values}
        errors={errors}
        isSubmitting={isSubmitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => (isDirty ? setShowLeaveDialog(true) : leaveToOverview())}
      />

      <Dialog
        isOpen={showLeaveDialog}
        title="Ungespeicherte Änderungen"
        onClose={() => setShowLeaveDialog(false)}
        secondaryAction={{ label: 'Weiter bearbeiten', onClick: () => setShowLeaveDialog(false) }}
        primaryAction={{
          label: 'Änderungen verwerfen',
          variant: 'destructive',
          onClick: () => {
            setShowLeaveDialog(false);
            leaveToOverview();
          },
        }}
      >
        <p>Deine Änderungen wurden noch nicht gespeichert.</p>
      </Dialog>
    </AdminLayout>
  );
}
