import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { CreateProductInput } from '../../domain/product/product';
import { productToFormInput, isSameProductInput } from '../../domain/product/productFormMapping';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateProductErrors } from '../../services/productValidation';
import { AdminProductLayout } from './AdminProductLayout';
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
    navigate('/admin/products', { replace: true });
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
      <AdminProductLayout title="Produkt bearbeiten">
        <EmptyState title="Produkt wird geladen" description="Die Produktdaten werden abgerufen." />
      </AdminProductLayout>
    );
  }

  if (!values) {
    return (
      <AdminProductLayout title="Produkt bearbeiten">
        <EmptyState
          title="Produkt nicht gefunden"
          description="Das angeforderte Produkt existiert nicht oder wurde entfernt."
        />
      </AdminProductLayout>
    );
  }

  return (
    <AdminProductLayout title="Produkt bearbeiten" subtitle="BestPay-Produkt aktualisieren">
      <ProductForm
        mode="edit"
        values={values}
        errors={errors}
        isSubmitting={isSubmitting}
        onChange={setValues}
        onSubmit={handleSubmit}
        onCancel={() => (isDirty ? setShowLeaveDialog(true) : leaveToOverview())}
      />

      <ConfirmDialog
        isOpen={showLeaveDialog}
        title="Ungespeicherte Änderungen"
        message="Deine Änderungen wurden noch nicht gespeichert."
        cancelLabel="Weiter bearbeiten"
        confirmLabel="Änderungen verwerfen"
        onCancel={() => setShowLeaveDialog(false)}
        onConfirm={() => {
          setShowLeaveDialog(false);
          leaveToOverview();
        }}
      />
    </AdminProductLayout>
  );
}
