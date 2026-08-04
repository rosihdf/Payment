import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_CREATE_PRODUCT_INPUT } from '../../domain/product/productDefaults';
import type { CreateProductInput } from '../../domain/product/product';
import { isSameProductInput } from '../../domain/product/productFormMapping';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import type { CreateProductErrors } from '../../services/productValidation';
import { AdminLayout } from '../admin/AdminLayout';
import { Dialog } from '../../v2/ui/Dialog';
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
    navigate('/admin/catalog?tab=products', { replace: true });
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
    <AdminLayout title="Produkt anlegen" subtitle="Neues BestPay-Produkt erfassen">
      <ProductForm
        mode="create"
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
