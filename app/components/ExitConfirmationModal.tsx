// /app/components/ExitConfirmationModal.tsx
"use client";

type ExitConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void; // Ação para quando o usuário confirma a saída
};

export default function ExitConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm 
}: ExitConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Deseja sair?</h2>
        <p className="mb-6 text-gray-600">O aplicativo será fechado.</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose} // Botão "Cancelar" apenas fecha o modal
            className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm} // Botão "Sair" executa a ação de fechar
            className="px-4 py-2 rounded-md text-white bg-red-500 hover:bg-red-600 font-semibold"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}