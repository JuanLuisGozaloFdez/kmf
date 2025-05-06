function loadFunction(functionName) {
  const functionTitle = document.getElementById('function-title');
  const functionWindow = document.getElementById('function-window');

  switch (functionName) {
    case 'documents':
      functionTitle.textContent = 'Manage Documents';
      functionWindow.innerHTML = '<p>Document management functionality goes here.</p>';
      fetchDocuments();
      break;
    case 'authorisations':
      functionTitle.textContent = 'Manage Authorisations';
      functionWindow.innerHTML = '<p>Authorisation management functionality goes here.</p>';
      break;
    case 'monitoring':
      functionTitle.textContent = 'System Monitoring';
      functionWindow.innerHTML = '<p>Monitoring logs and errors functionality goes here.</p>';
      break;
    case 'verification':
      functionTitle.textContent = 'Smart Contract Verification';
      functionWindow.innerHTML = '<p>Smart contract verification functionality goes here.</p>';
      break;
    case 'configuration':
      functionTitle.textContent = 'Configuration';
      functionWindow.innerHTML = `
        <div class="configuration-menu">
          <label>Path:</label><input type="text" placeholder="Enter path"><br>
          <label>Color:</label><input type="color"><br>
          <label>Look & Feel:</label><select>
            <option>Default</option>
            <option>Dark</option>
            <option>Light</option>
          </select>
        </div>`;
      break;
    default:
      functionTitle.textContent = 'Administrative Functions';
      functionWindow.innerHTML = '<p>Select a function from the menu.</p>';
  }
}

// Example API base URL
const API_BASE_URL = "https://api.kmf.es/documents";

// Fetch and display documents
async function fetchDocuments() {
  try {
    const response = await fetch(`${API_BASE_URL}`);
    if (!response.ok) throw new Error("Failed to fetch documents");
    const documents = await response.json();
    displayDocuments(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
  }
}

// Display documents in the central area
function displayDocuments(documents) {
  const centralArea = document.querySelector(".central-area");
  centralArea.innerHTML = ""; // Clear existing content
  documents.forEach((doc) => {
    const docElement = document.createElement("div");
    docElement.className = "document-item";
    docElement.textContent = doc.name;
    centralArea.appendChild(docElement);
  });
}

// Add a new document
async function addDocument(documentName) {
  try {
    const response = await fetch(`${API_BASE_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: documentName }),
    });
    if (!response.ok) throw new Error("Failed to add document");
    fetchDocuments(); // Refresh the document list
  } catch (error) {
    console.error("Error adding document:", error);
  }
}

// Delete a document
async function deleteDocument(documentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/${documentId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete document");
    fetchDocuments(); // Refresh the document list
  } catch (error) {
    console.error("Error deleting document:", error);
  }
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  fetchDocuments();
});
