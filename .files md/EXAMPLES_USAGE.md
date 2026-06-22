/**
 * EJEMPLOS DE USO - Marketing Center Endpoints
 * File: EXAMPLES_USAGE.md
 */

# 📚 Ejemplos de Uso de Endpoints

---

## 1️⃣ CARGAR DATOS INICIALES PARA MARKETING CENTER

```typescript
import {
  companiesApi,
  tagsApi,
  clientTypesApi,
  marketingToolsApi,
  marketingContactsApi
} from '@/services/marketingHelpers';

const idTenant = 'tenant_123';
const idUser = 'user_123';

async function initializeMarketingCenter() {
  try {
    // En paralelo, cargar todos los datos
    const [companies, tags, clientTypes, filterOptions] = await Promise.all([
      companiesApi.getAll(idTenant),
      tagsApi.getAll(idTenant),
      clientTypesApi.getAll(idTenant),
      marketingToolsApi.getFilterOptions(idTenant)
    ]);

    console.log('✅ Empresas:', companies);
    console.log('✅ Etiquetas:', tags);
    console.log('✅ Tipos de cliente:', clientTypes);
    console.log('✅ Opciones de filtros:', filterOptions);

    return {
      companies,
      tags,
      clientTypes,
      filterOptions
    };
  } catch (error) {
    console.error('❌ Error inicializando Marketing Center:', error);
  }
}
```

---

## 2️⃣ FILTRAR CONTACTOS POR ETIQUETA Y CATEGORÍA

```typescript
async function filterContactsByTagAndCategory() {
  try {
    // Búsqueda: Contactos VIP en empresas B2B
    const contacts = await marketingContactsApi.search(
      idTenant,
      idUser,
      {
        company_tags: ['VIP'],           // Solo etiqueta VIP
        company_category: 'B2B'           // Solo categoría B2B
      }
    );

    console.log(`✅ Encontrados ${contacts.length} contactos VIP en B2B`);
    return contacts;
  } catch (error) {
    console.error('❌ Error filtrando contactos:', error);
  }
}
```

---

## 3️⃣ BUSCAR CONTACTOS POR UBICACIÓN (CIUDAD Y PAÍS)

```typescript
async function searchContactsByLocation() {
  try {
    // Búsqueda: Contactos en Quito, Ecuador
    const quitoContacts = await marketingContactsApi.search(
      idTenant,
      idUser,
      {
        city: 'quito',
        country: 'EC'
      }
    );

    console.log(`✅ Encontrados ${quitoContacts.length} contactos en Quito, Ecuador`);

    // Búsqueda: Contactos en Colombia
    const colombiaContacts = await marketingContactsApi.search(
      idTenant,
      idUser,
      {
        country: 'CO'
      }
    );

    console.log(`✅ Encontrados ${colombiaContacts.length} contactos en Colombia`);

    return { quitoContacts, colombiaContacts };
  } catch (error) {
    console.error('❌ Error buscando por ubicación:', error);
  }
}
```

---

## 4️⃣ BÚSQUEDA AVANZADA COMBINADA

```typescript
async function advancedSearch() {
  try {
    // Búsqueda compleja: Directores, en empresas B2B Software, tags VIP/Partner, en Latinoamérica
    const contacts = await marketingContactsApi.search(
      idTenant,
      idUser,
      {
        search: '',                        // Sin término específico
        company_category: 'B2B',           // Categoría B2B
        company_tags: ['VIP', 'Partner'],  // Múltiples etiquetas
        position: 'director',              // Cargo específico
        industry: 'software',              // Industria
        country: 'EC'                      // País
      }
    );

    console.log(`✅ Encontrados ${contacts.length} directores en empresas B2B Software`);

    // Mostrar resultados
    contacts.forEach((contact, idx) => {
      console.log(`${idx + 1}. ${contact.first_name} ${contact.last_name}`);
      console.log(`   Email: ${contact.email}`);
      console.log(`   Empresa: ${contact.company_name}`);
      console.log(`   Cargo: ${contact.position}`);
      console.log(`   Ubicación: ${contact.city}, ${contact.country}`);
      console.log('---');
    });

    return contacts;
  } catch (error) {
    console.error('❌ Error en búsqueda avanzada:', error);
  }
}
```

---

## 5️⃣ CREAR Y USAR ETIQUETAS PERSONALIZADAS

```typescript
async function manageCustomTags() {
  try {
    // Crear nuevas etiquetas
    const newTag1 = await tagsApi.create(idTenant, {
      name: 'Proyecto XYZ',
      color: '#FF6B6B',
      description: 'Contactos interesados en Proyecto XYZ',
      type: 'company'
    });

    const newTag2 = await tagsApi.create(idTenant, {
      name: 'Decision Maker',
      color: '#4ECDC4',
      description: 'Tomadores de decisiones',
      type: 'contact'
    });

    console.log('✅ Etiquetas creadas:', newTag1, newTag2);

    // Obtener todas las etiquetas
    const allTags = await tagsApi.getAll(idTenant);
    console.log('✅ Total etiquetas disponibles:', allTags.length);

    // Filtrar por la nueva etiqueta
    const contactsWithTag = await marketingContactsApi.search(
      idTenant,
      idUser,
      {
        company_tags: ['Proyecto XYZ']
      }
    );

    console.log(`✅ Contactos con etiqueta 'Proyecto XYZ':`, contactsWithTag.length);

    return { newTag1, newTag2, allTags, contactsWithTag };
  } catch (error) {
    console.error('❌ Error gestionando etiquetas:', error);
  }
}
```

---

## 6️⃣ CREAR NUEVA EMPRESA Y ASIGNAR CATEGORÍA

```typescript
async function createNewCompany() {
  try {
    // Crear empresa
    const newCompany = await companiesApi.create(idTenant, {
      name_company: 'Innovatech Solutions',
      type_client: 'EMPRESA',
      category: 'B2B',
      industry: 'Artificial Intelligence',
      tags: ['Tech', 'AI', 'Innovation'],
      city: 'Quito',
      country: 'Ecuador',
      email: 'contact@innovatech.com',
      phone: '+593-2-999-8888'
    });

    console.log('✅ Empresa creada:', newCompany);

    // Obtener la empresa
    const company = await companiesApi.getById(newCompany.id_client_company);
    console.log('✅ Empresa recuperada:', company);

    return company;
  } catch (error) {
    console.error('❌ Error creando empresa:', error);
  }
}
```

---

## 7️⃣ CREAR CONTACTO Y ASIGNAR A EMPRESA

```typescript
async function createContactForCompany() {
  try {
    // Crear contacto
    const newContact = await contactsApi.create(idTenant, {
      id_client_company: 'cc_001',  // ID de la empresa
      first_name: 'Carlos',
      last_name: 'González',
      email: 'carlos.gonzalez@innovatech.com',
      position: 'Chief Technology Officer',
      city: 'Quito',
      country: 'Ecuador',
      phone: '+593-9-888-7777'
    });

    console.log('✅ Contacto creado:', newContact);

    // Obtener contacto
    const contact = await contactsApi.getById(newContact.id_contact);
    console.log('✅ Contacto recuperado:', contact);

    // Obtener todos los contactos de la empresa
    const companyContacts = await contactsApi.getByCompany('cc_001');
    console.log(`✅ Total contactos en empresa: ${companyContacts.length}`);

    return contact;
  } catch (error) {
    console.error('❌ Error creando contacto:', error);
  }
}
```

---

## 8️⃣ AGREGAR MÚLTIPLES CONTACTOS A LISTA

```typescript
async function addContactsToList() {
  try {
    const listId = 'list_123';
    const contactIds = [
      'contact_001',
      'contact_002',
      'contact_003',
      'contact_004',
      'contact_005'
    ];

    // Agregar contactos
    const result = await marketingListsApi.addMembers(
      listId,
      idUser,
      contactIds
    );

    console.log('✅ Contactos agregados a lista:', result);

    // Obtener miembros de la lista
    const members = await marketingListsApi.getMembers(listId, idUser);
    console.log(`✅ Total miembros en lista: ${members.length}`);

    return result;
  } catch (error) {
    console.error('❌ Error agregando contactos:', error);
  }
}
```

---

## 9️⃣ CREAR LISTA CON CONTACTOS FILTRADOS

```typescript
async function createListFromFilteredContacts() {
  try {
    // 1. Buscar contactos con criterios específicos
    const contacts = await marketingContactsApi.search(
      idTenant,
      idUser,
      {
        company_category: 'B2B',
        company_industry: 'Software',
        country: 'EC',
        position: 'gerente'
      }
    );

    console.log(`✅ Encontrados ${contacts.length} contactos que coinciden`);

    // 2. Crear lista (asumiendo que existe createList en marketingApi)
    const listId = 'list_' + Date.now();

    // 3. Agregar todos los contactos a la lista
    const contactIds = contacts.map(c => c.id_contact);
    
    const result = await marketingListsApi.addMembers(
      listId,
      idUser,
      contactIds
    );

    console.log(`✅ Lista creada con ${contactIds.length} contactos`);
    console.log('📊 Resultado:', result);

    return result;
  } catch (error) {
    console.error('❌ Error creando lista:', error);
  }
}
```

---

## 🔟 GESTIONAR OPCIONES DE FILTROS

```typescript
async function manageFilterOptions() {
  try {
    // Obtener opciones disponibles
    const filterOptions = await marketingToolsApi.getFilterOptions(idTenant);

    console.log('✅ Categorías disponibles:', filterOptions.categories);
    console.log('✅ Etiquetas disponibles:', filterOptions.tags);
    console.log('✅ Países disponibles:', filterOptions.countries);
    console.log('✅ Ciudades disponibles:', filterOptions.cities);
    console.log('✅ Industrias disponibles:', filterOptions.industries);

    // Crear nuevas opciones si es necesario
    const newCategory = await marketingToolsApi.createFilterOption(
      idTenant,
      {
        type: 'category',
        value: 'b2b2c',
        label: 'B2B2C'
      }
    );

    console.log('✅ Nueva categoría creada:', newCategory);

    return filterOptions;
  } catch (error) {
    console.error('❌ Error gestionando filtros:', error);
  }
}
```

---

## 1️⃣1️⃣ COMPONENTE COMPLETO - MODAL DE FILTRADO

```typescript
import React, { useState, useEffect } from 'react';
import {
  marketingToolsApi,
  marketingContactsApi,
  marketingListsApi
} from '@/services/marketingHelpers';

interface AdvancedFilterModalProps {
  isOpen: boolean;
  listId: string;
  idTenant: string;
  idUser: string;
  onClose: () => void;
}

export const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({
  isOpen,
  listId,
  idTenant,
  idUser,
  onClose
}) => {
  const [filters, setFilters] = useState({
    company_category: '',
    company_tags: [] as string[],
    city: '',
    country: '',
    industry: ''
  });

  const [filterOptions, setFilterOptions] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Cargar opciones
  useEffect(() => {
    if (isOpen) {
      loadFilterOptions();
    }
  }, [isOpen]);

  const loadFilterOptions = async () => {
    try {
      const options = await marketingToolsApi.getFilterOptions(idTenant);
      setFilterOptions(options);
    } catch (error) {
      console.error('Error cargando opciones:', error);
    }
  };

  // Buscar contactos
  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await marketingContactsApi.search(
        idTenant,
        idUser,
        filters
      );
      setContacts(results);
      setSelected(new Set());
    } catch (error) {
      console.error('Error buscando contactos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Agregar a lista
  const handleAddToList = async () => {
    if (selected.size === 0) return;

    try {
      const contactIds = Array.from(selected);
      await marketingListsApi.addMembers(listId, idUser, contactIds);
      alert(`✅ ${selected.size} contactos agregados a la lista`);
      onClose();
    } catch (error) {
      console.error('Error agregando contactos:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <h2>Búsqueda Avanzada</h2>

      {/* Filtros */}
      <div className="filters">
        <select
          value={filters.company_category}
          onChange={(e) => setFilters({ ...filters, company_category: e.target.value })}
        >
          <option value="">Categoría</option>
          {filterOptions?.categories.map((cat: any) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        <select
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
        >
          <option value="">Ciudad</option>
          {filterOptions?.cities.map((city: any) => (
            <option key={city.value} value={city.value}>
              {city.label}
            </option>
          ))}
        </select>

        <select
          value={filters.country}
          onChange={(e) => setFilters({ ...filters, country: e.target.value })}
        >
          <option value="">País</option>
          {filterOptions?.countries.map((country: any) => (
            <option key={country.value} value={country.value}>
              {country.label}
            </option>
          ))}
        </select>

        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Resultados */}
      <div className="results">
        <p>Encontrados: {contacts.length}</p>
        {contacts.map((contact) => (
          <label key={contact.id_contact}>
            <input
              type="checkbox"
              checked={selected.has(contact.id_contact)}
              onChange={(e) => {
                const newSet = new Set(selected);
                if (e.target.checked) {
                  newSet.add(contact.id_contact);
                } else {
                  newSet.delete(contact.id_contact);
                }
                setSelected(newSet);
              }}
            />
            {contact.first_name} {contact.last_name} - {contact.email}
          </label>
        ))}
      </div>

      {/* Acciones */}
      <div className="actions">
        <button onClick={handleAddToList} disabled={selected.size === 0}>
          Agregar {selected.size} contactos
        </button>
        <button onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
};
```

---

## 📞 REFERENCIA RÁPIDA

| Función | Uso | Retorna |
|---------|-----|---------|
| `companiesApi.getAll()` | Obtener empresas | Company[] |
| `tagsApi.getAll()` | Obtener etiquetas | Tag[] |
| `tagsApi.getByType()` | Filtrar por tipo | Tag[] |
| `clientTypesApi.getAll()` | Tipos de cliente | ClientType[] |
| `marketingToolsApi.getFilterOptions()` | Opciones disponibles | FilterOptions |
| `marketingContactsApi.search()` | Búsqueda avanzada | Contact[] |
| `marketingListsApi.addMembers()` | Agregar a lista | Result |
| `marketingListsApi.removeMembers()` | Remover de lista | Result |

---

## ⚡ TIPS Y TRUCOS

### ✅ Búsqueda eficiente
```typescript
// Usar Promise.all para cargas en paralelo
const [contacts, tags, companies] = await Promise.all([
  marketingContactsApi.search(...),
  tagsApi.getAll(...),
  companiesApi.getAll(...)
]);
```

### ✅ Filtros combinados
```typescript
// Combinar múltiples filtros
const contacts = await marketingContactsApi.search(idTenant, idUser, {
  company_category: 'B2B',
  company_tags: ['VIP', 'Partner'],
  country: 'EC',
  industry: 'Software'
});
```

### ✅ Debounce en búsqueda
```typescript
const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

const handleSearchChange = (query: string) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  
  setSearchTimeout(
    setTimeout(async () => {
      const results = await marketingContactsApi.search(
        idTenant,
        idUser,
        { search: query }
      );
      setContacts(results);
    }, 500)
  );
};
```

---

## 🐛 TROUBLESHOOTING

### Error: "VITE_WEBHOOK_URL no está configurada"
**Solución:** Asegurate que en `.env` tienes:
```
VITE_WEBHOOK_URL=https://tu-n8n-instance.com
```

### Error: "Contactos no encontrados"
**Solución:** Verifica que los filtros coincidan con datos reales en el backend

### Error: "Acceso denegado"
**Solución:** Verifica que `id_tenant` e `id_user` sean válidos
