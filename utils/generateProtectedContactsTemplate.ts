

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Tipos de ID permitidos (constante reutilizable)
const TIPOS_ID = ['RUC', 'Cédula', 'Pasaporte', 'ID. DEL EXTERIOR'];

export async function generateProtectedContactsTemplate(
  company_labels: string[] = [],
  company_types: string[] = [],
  countries: string[] = []
) {
  if (!Array.isArray(company_labels) || company_labels.length === 0) {
    alert('No hay etiquetas de empresa configuradas. Se usará un valor de ejemplo.');
    company_labels = ['Cliente'];
  }
  if (!Array.isArray(company_types) || company_types.length === 0) {
    alert('No hay tipos de empresa configurados. Se usará un valor de ejemplo.');
    company_types = ['Comercial'];
  }
  if (!Array.isArray(countries) || countries.length === 0) {
    alert('No hay países configurados. Se usará un valor de ejemplo.');
    countries = ['Ecuador'];
  }
  const workbook = new ExcelJS.Workbook();


  // Hoja principal
  const ws = workbook.addWorksheet('Plantilla', {
    properties: { tabColor: { argb: 'FF00BFAE' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  // Hoja de tipos de ID (oculta)
  const wsTiposId = workbook.addWorksheet('TiposID');
  TIPOS_ID.forEach((tipo, i) => {
    wsTiposId.getCell(`A${i + 1}`).value = tipo;
  });
  wsTiposId.state = 'veryHidden';

  // Validación de lista para Tipo ID (columna A)
  const tiposIdRange = `TiposID!$A$1:$A$${TIPOS_ID.length}`;
  for (let i = 2; i <= 1000; i++) {
    ws.getCell(`A${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [tiposIdRange],
      showInputMessage: true,
      promptTitle: 'Tipo ID',
      prompt: 'Selecciona un tipo de ID válido.'
    };
  }

  // Encabezados y estructura según requerimiento
  const columns = [
    { header: 'Tipo ID Empresa', key: 'id_type', width: 20 },
    { header: 'ID Empresa', key: 'id_number', width: 20 },
    { header: 'Nombre Empresa*', key: 'name_company', width: 28 },
    { header: 'Razón Social Empresa', key: 'razon_social', width: 28 },
    { header: 'Dirección Empresa', key: 'address', width: 28 },
    { header: 'Ciudad Empresa', key: 'city', width: 18 },
    { header: 'Teléfono Empresa', key: 'phone_company', width: 18 },
    { header: 'Email Empresa', key: 'email_company', width: 24 },
    { header: 'Web Empresa', key: 'website', width: 22 },
    { header: 'Etiquetas (Nombres) Empresa', key: 'labels', width: 24 },
    { header: 'Tipo Empresa', key: 'company_type', width: 22 },
    { header: 'País Empresa', key: 'country', width: 18 },
    { header: 'Nombre Contacto*', key: 'first_name', width: 18 },
    { header: 'Apellido Contacto*', key: 'last_name', width: 18 },
    { header: 'Email Contacto', key: 'email', width: 24 },
    { header: 'Teléfono Contacto', key: 'phone', width: 18 },
    { header: 'Cargo / Posición Contacto', key: 'position', width: 28 },
  ];
  ws.columns = columns;

  // Fila de ejemplo SIEMPRE en la fila 2
  ws.insertRow(2, {
    id_type: 'RUC',
    id_number: '1234567890',
    name_company: 'Ejemplo S.A.',
    razon_social: 'Ejemplo Sociedad Anónima',
    address: 'Calle Falsa 123',
    city: 'Quito',
    phone_company: '0999999999',
    email_company: 'contacto@ejemplo.com',
    website: 'www.ejemplo.com',
    labels: 'Cliente,VIP',
    company_type: 'Comercial',
    country: 'Ecuador',
    first_name: 'Ana',
    last_name: 'García',
    email: 'ana.garcia@ejemplo.com',
    phone: '+593987654321',
    position: 'Administradora',
  });

  // Establecer formato de texto para todas las celdas de datos (filas 2-1000)
  for (let i = 2; i <= 1000; i++) {
    ws.getRow(i).eachCell(cell => {
      cell.numFmt = '@'; // Formato de texto para evitar conversión a notación científica
    });
  }

  // Hoja de tipos de empresa (oculta)
  const wsTypes = workbook.addWorksheet('TiposEmpresa');
  company_types.forEach((type, i) => {
    wsTypes.getCell(`A${i + 1}`).value = type;
  });
  wsTypes.state = 'veryHidden';

  // Hoja de países (oculta)
  const wsCountries = workbook.addWorksheet('Paises');
  countries.forEach((country, i) => {
    wsCountries.getCell(`A${i + 1}`).value = country;
  });
  wsCountries.state = 'veryHidden';

  // Validación de lista para Tipo de Empresa y País
  for (let i = 2; i <= 1000; i++) {
    ws.getCell(`K${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`TiposEmpresa!$A$1:$A$${company_types.length}`],
      showInputMessage: true,
      promptTitle: 'Tipo de Empresa',
      prompt: 'Selecciona un tipo de empresa válido.'
    };
    ws.getCell(`L${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Paises!$A$1:$A$${countries.length}`],
      showInputMessage: true,
      promptTitle: 'País',
      prompt: 'Selecciona un país válido.'
    };
  }

  // Proteger encabezados (no editable) y desbloquear celdas de datos
  ws.getRow(1).eachCell(cell => {
    cell.protection = { locked: true };
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00BFAE' } };
  });
  // Desbloquear celdas de datos (filas 2 a 1000)
  for (let i = 2; i <= 1000; i++) {
    ws.getRow(i).eachCell(cell => {
      cell.protection = { locked: false };
    });
  }
  // NO proteger la hoja - permitir edición libre con listas desplegables en Tipo de Empresa y País

  // Hoja de etiquetas (oculta)
  const wsLabels = workbook.addWorksheet('Etiquetas');
  company_labels.forEach((label, i) => {
    wsLabels.getCell(`A${i + 1}`).value = label;
  });
  wsLabels.state = 'veryHidden';

  // Solo mensaje de ayuda para multietiqueta, sin validación restrictiva
  for (let i = 2; i <= 1000; i++) {
    ws.getCell(`H${i}`).dataValidation = {
      showInputMessage: true,
      promptTitle: 'Etiquetas (multi)',
      prompt: 'Puedes escribir varias etiquetas separadas por coma (ej: Cliente,Proveedor).',
    };
  }

  // Descargar archivo
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), 'Plantilla_Importacion_Contactos.xlsx');
}
