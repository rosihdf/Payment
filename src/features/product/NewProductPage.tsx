import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { DEFAULT_CREATE_PRODUCT_INPUT } from '../../domain/product/productDefaults';
import type { CreateProductInput } from '../../domain/product/product';
import { isSameProductInput } from '../../domain/product/productFormMapping';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateProductErrors } from '../../services/productValidation';
import { AdminProductLayout } from './AdminProductLayout';
import { ProductForm } from './ProductForm';

export function NewProductPage() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { productService } = useServices();
  const { showToast } = useToast();
  const [values, setValues] = useState<CreateProductInput>(DEFAULT_CREATE_PRODUCT_INPUT);
  const [errors, setErrors] = useState<CreateProductErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);

  const isDirty = !isSameProductInput(values, DEFAULT_CREATE_PRODUCT_INPUT);
  useBeforeUnload(isDirty && !allowLeave);

  const leaveToOverview = () => {
    setAllowLeave(true);
    navigate('/admin/products', { replace: true });
  };

  const handleSubmit = () => {
    if (isSubmitting || !currentUser) {
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setErrors({});
      const result = await productService.createProduct(values, { role: currentUser.role });

      if (!result.ok) {
        if ('errors' in result) {
          setErrors(result.errors);
          showToast('Bitte prüfen Sie die markierten Felder.', 'error');
        } else {
          showToast('Produkt konnte nicht angelegt werden', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      showToast('Produkt wurde angelegt', 'success');
      leaveToOverview();
    })();
  };

  return (
    <AdminProductLayout title="Produkt anlegen" subtitle="Neues BestPay-Produkt erfassen">
      <ProductForm
        mode="create"
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
