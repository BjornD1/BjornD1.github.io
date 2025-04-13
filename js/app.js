// Add these variables at the top of your file, with your other state variables
let currentUser = null;
const loginContainer = document.getElementById('login-container');
const headerActions = document.getElementById('header-actions');

// Add these authentication functions to your app.js file

// Initialize auth state listener
function initAuth() {
  window.firebaseAuth.onAuthStateChanged(window.auth, (user) => {
    if (user) {
      // User is signed in
      currentUser = user;
      console.log("User signed in:", user.email);
      showUserInterface();
      loadData(); // Load user-specific data
    } else {
      // User is signed out
      currentUser = null;
      console.log("User is signed out");
      showLoginInterface();
    }
  });
}

// Show the user interface (after successful login)
function showUserInterface() {
  // Hide login container
  loginContainer.classList.add('hidden');
  
  // Show kanban board
  kanbanBoard.classList.remove('hidden');
  
  // Update header with user info and logout button
  updateHeaderWithUserInfo();
}

// Update header with user info and logout button
function updateHeaderWithUserInfo() {
  if (!currentUser) return;
  
  // Clear existing content
  headerActions.innerHTML = '';
  
  // Create user info display
  const userInfo = document.createElement('div');
  userInfo.className = 'user-info';
  userInfo.innerHTML = `<span>${currentUser.email}</span>`;
  
  // Create button group
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  
  // Create view completed button
  const viewCompletedBtn = document.createElement('button');
  viewCompletedBtn.id = 'view-completed';
  viewCompletedBtn.className = 'btn';
  viewCompletedBtn.textContent = 'View Completed Tasks';
  viewCompletedBtn.addEventListener('click', toggleCompletedTasksView);
  
  // Create logout button
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.className = 'btn';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', logout);
  
  // Add buttons to button group
  buttonGroup.appendChild(viewCompletedBtn);
  buttonGroup.appendChild(logoutBtn);
  
  // Add elements to header actions
  headerActions.appendChild(userInfo);
  headerActions.appendChild(buttonGroup);
}

// Show the login interface
function showLoginInterface() {
  // Hide kanban board and completed tasks
  kanbanBoard.classList.add('hidden');
  completedTasksView.classList.add('hidden');
  
  // Show login container
  loginContainer.classList.remove('hidden');
  
  // Make sure event listeners are set up
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('register-btn').addEventListener('click', register);
}

// Login function
async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorElement = document.getElementById('auth-error');
  
  // Basic validation
  if (!email || !password) {
    errorElement.textContent = 'Please enter both email and password';
    return;
  }
  
  try {
    await window.firebaseAuth.signInWithEmailAndPassword(window.auth, email, password);
    // onAuthStateChanged will handle the rest
  } catch (error) {
    console.error('Login error:', error);
    errorElement.textContent = error.message;
  }
}

// Register function
async function register() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorElement = document.getElementById('auth-error');
  
  // Basic validation
  if (!email || !password) {
    errorElement.textContent = 'Please enter both email and password';
    return;
  }
  
  // Password validation
  if (password.length < 6) {
    errorElement.textContent = 'Password must be at least 6 characters';
    return;
  }
  
  try {
    await window.firebaseAuth.createUserWithEmailAndPassword(window.auth, email, password);
    // onAuthStateChanged will handle the rest
  } catch (error) {
    console.error('Registration error:', error);
    errorElement.textContent = error.message;
  }
}

// Logout function
async function logout() {
  try {
    await window.firebaseAuth.signOut(window.auth);
    // onAuthStateChanged will handle the redirect
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Error logging out. Please try again.', 'error');
  }
}


// Update these database-related functions to use the current user's ID

// Load data from Firestore
async function loadData() {
  if (!currentUser) return;
  
  try {
    // Show loading indicator
    kanbanBoard.innerHTML = '<div class="loading">Loading your tasks...</div>';
    
    // Initialize empty tasks object with all columns
    tasks = {};
    columns.forEach(column => {
      tasks[column.id] = [];
    });
    
    // Get tasks from Firestore - now using currentUser.uid instead of "default-user"
    const tasksCollection = window.firestore.collection(window.db, `users/${currentUser.uid}/tasks`);
    const snapshot = await window.firestore.getDocs(tasksCollection);
    
    snapshot.forEach(doc => {
      const task = doc.data();
      task.id = doc.id; // Use Firestore document ID as task ID
      if (tasks[task.column]) {
        tasks[task.column].push(task);
      }
    });
    
    // Get completed tasks
    const completedTasksCollection = window.firestore.collection(window.db, `users/${currentUser.uid}/completedTasks`);
    const completedSnapshot = await window.firestore.getDocs(completedTasksCollection);
    
    completedTasks = [];
    completedSnapshot.forEach(doc => {
      const task = doc.data();
      task.id = doc.id;
      completedTasks.push(task);
    });
    
    // Sort completed tasks by completedAt date (newest first)
    completedTasks.sort((a, b) => {
      return new Date(b.completedAt) - new Date(a.completedAt);
    });
    
    // Show the board
    renderBoard();
  } catch (error) {
    console.error("Error loading data:", error);
    
    // Fall back to localStorage if Firestore fails
    const savedTasks = localStorage.getItem(`kanban-tasks-${currentUser.uid}`);
    const savedCompletedTasks = localStorage.getItem(`kanban-completed-tasks-${currentUser.uid}`);
    
    tasks = savedTasks ? JSON.parse(savedTasks) : {};
    completedTasks = savedCompletedTasks ? JSON.parse(savedCompletedTasks) : [];
    
    // Initialize empty arrays for any missing columns
    columns.forEach(column => {
      if (!tasks[column.id]) {
        tasks[column.id] = [];
      }
    });
    
    renderBoard();
    
    showNotification('Error loading from database. Using local data instead.', 'error');
  }
}

// Save data to local storage (as backup) - now user-specific
function saveDataToLocalStorage() {
  if (!currentUser) return;
  
  localStorage.setItem(`kanban-tasks-${currentUser.uid}`, JSON.stringify(tasks));
  localStorage.setItem(`kanban-completed-tasks-${currentUser.uid}`, JSON.stringify(completedTasks));
}

// Update the saveTask function to use currentUser.uid
async function saveTask(e) {
  e.preventDefault();
  
  if (!currentUser || !currentTask) return;

  // Rest of function remains the same, but with these changes to database references:
  
  /* Replace:
  const tasksCollection = window.firestore.collection(window.db, `users/default-user/tasks`);
  
  With:
  const tasksCollection = window.firestore.collection(window.db, `users/${currentUser.uid}/tasks`); 
  */
  
  /* Replace:
  const taskDoc = window.firestore.doc(window.db, `users/default-user/tasks/${currentTask.id}`);
  
  With:
  const taskDoc = window.firestore.doc(window.db, `users/${currentUser.uid}/tasks/${currentTask.id}`);
  */
}

// Update all other database functions (deleteTask, completeTask, restoreTask, handleDrop) the same way
// Replace all instances of "default-user" with currentUser.uid

// Update your init function to initialize authentication
function init() {
  // Add notification CSS
  addNotificationStyles();
  
  // Initialize authentication
  initAuth();
  
  // Add a wrapper around the due date input and add a clear button
  const dueDateWrapper = document.createElement('div');
  dueDateWrapper.className = 'due-date-container';
  
  // Get the original due date input
  const originalDueDateInput = taskDueDateInput;
  
  // Create a clear button
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'clear-date-btn';
  clearBtn.innerHTML = '&times;';
  clearBtn.title = 'Clear due date';
  clearBtn.addEventListener('click', function() {
    originalDueDateInput.value = '';
  });
  
  // Replace the input with the wrapper
  originalDueDateInput.parentNode.replaceChild(dueDateWrapper, originalDueDateInput);
  
  // Add the input and button to the wrapper
  dueDateWrapper.appendChild(originalDueDateInput);
  dueDateWrapper.appendChild(clearBtn);
  
  // Set up other event listeners
  taskForm.addEventListener('submit', saveTask);
  deleteTaskBtn.addEventListener('click', deleteTask);
  completeTaskBtn.addEventListener('click', completeTask);
  closeModalBtn.addEventListener('click', closeTaskModal);
  
  // Make the date field show the calendar when clicked
  taskDueDateInput.addEventListener('click', function() {
    // This forces the calendar to show by triggering the click event programmatically
    this.showPicker();
  });
  
  // Close modal when clicking outside
  taskModal.addEventListener('click', function(event) {
    // If the click was directly on the modal background (not on its children)
    if (event.target === taskModal) {
      closeTaskModal();
    }
  });
}

// Add this function to add CSS for authentication
function addAuthStyles() {
  const authCSS = `
    .user-info {
      display: flex;
      align-items: center;
      color: var(--text-dim);
      margin-right: 1rem;
    }
    
    .button-group {
      display: flex;
      gap: 0.5rem;
    }
    
    .login-container {
      max-width: 400px;
      margin: 50px auto;
      background-color: var(--bg-column);
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }
    
    .login-container h2 {
      margin-bottom: 1.5rem;
      text-align: center;
    }
    
    .login-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 1.5rem;
    }
    
    .error-message {
      color: var(--danger);
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }
  `;
  
  const style = document.createElement('style');
  style.textContent = authCSS;
  document.head.appendChild(style);
}

// Define the columns
const columns = [
  { id: 'waiting-on', title: 'Waiting On', color: 'neon-blue' },
  { id: 'in-progress', title: 'In Progress', color: 'neon-green' },
  { id: 'on-deck', title: 'On Deck', color: 'neon-yellow' },
  { id: 'pipeline', title: 'Pipeline', color: 'neon-orange' },
  { id: 'low-priority', title: 'Low Priority', color: 'neon-purple' },
  { id: 'ideas', title: 'Ideas', color: 'neon-pink' }
];

// State management
let tasks = {};
let completedTasks = [];
let currentTask = null;
let draggedTask = null;
const userId = "currentUser.uid"; // We'll replace this with real authentication later

// DOM elements
const kanbanBoard = document.getElementById('kanban-board');
const completedTasksView = document.getElementById('completed-tasks');
const completedList = document.getElementById('completed-list');
const viewCompletedBtn = document.getElementById('view-completed');
const backToBoardBtn = document.getElementById('back-to-board');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const taskTitleInput = document.getElementById('task-title');
const taskDescriptionInput = document.getElementById('task-description');
const taskDueDateInput = document.getElementById('task-due-date');
const taskColumnDisplay = document.getElementById('task-column');
const taskBigThreeCheckbox = document.getElementById('task-big-three');
const deleteTaskBtn = document.getElementById('delete-task');
const completeTaskBtn = document.getElementById('complete-task');
const closeModalBtn = document.getElementById('close-modal');

// Load data from Firestore
async function loadData() {
  try {
    // Show loading indicator
    kanbanBoard.innerHTML = '<div class="loading">Loading your tasks...</div>';
    
    // Initialize empty tasks object with all columns
    tasks = {};
    columns.forEach(column => {
      tasks[column.id] = [];
    });
    
    // Get tasks from Firestore
    const tasksCollection = window.firestore.collection(window.db, `users/${userId}/tasks`);
    const snapshot = await window.firestore.getDocs(tasksCollection);
    
    snapshot.forEach(doc => {
      const task = doc.data();
      task.id = doc.id; // Use Firestore document ID as task ID
      if (tasks[task.column]) {
        tasks[task.column].push(task);
      }
    });
    
    // Get completed tasks
    const completedTasksCollection = window.firestore.collection(window.db, `users/${userId}/completedTasks`);
    const completedSnapshot = await window.firestore.getDocs(completedTasksCollection);
    
    completedTasks = [];
    completedSnapshot.forEach(doc => {
      const task = doc.data();
      task.id = doc.id;
      completedTasks.push(task);
    });
    
    // Sort completed tasks by completedAt date (newest first)
    completedTasks.sort((a, b) => {
      return new Date(b.completedAt) - new Date(a.completedAt);
    });
    
    // Show the board
    renderBoard();
  } catch (error) {
    console.error("Error loading data:", error);
    
    // Fall back to localStorage if Firestore fails
    const savedTasks = localStorage.getItem('kanban-tasks-${currentUser.uid}');
    const savedCompletedTasks = localStorage.getItem('kanban-completed-tasks');
    
    tasks = savedTasks ? JSON.parse(savedTasks) : {};
    completedTasks = savedCompletedTasks ? JSON.parse(savedCompletedTasks) : [];
    
    // Initialize empty arrays for any missing columns
    columns.forEach(column => {
      if (!tasks[column.id]) {
        tasks[column.id] = [];
      }
    });
    
    renderBoard();
    
    showNotification('Error loading from database. Using local data instead.', 'error');
  }
}

// Save data to local storage (as backup)
function saveDataToLocalStorage() {
  localStorage.setItem('kanban-tasks', JSON.stringify(tasks));
  localStorage.setItem('kanban-completed-tasks', JSON.stringify(completedTasks));
}

// Generate a unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get column title from ID
function getColumnTitle(columnId) {
  const column = columns.find(col => col.id === columnId);
  return column ? column.title : '';
}

// Render the kanban board
function renderBoard() {
  kanbanBoard.innerHTML = '';
  
  columns.forEach(column => {
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.id = column.id;
    
    // Get task count for this column
    const taskCount = tasks[column.id].length;
    
    columnEl.innerHTML = `
      <div class="column-header">
        <h2>${column.title} <span class="task-count">${taskCount}</span></h2>
      </div>
      <div class="tasks" data-column="${column.id}"></div>
      <button class="add-task-btn" data-column="${column.id}">+</button>
    `;
    
    kanbanBoard.appendChild(columnEl);
    
    const tasksContainer = columnEl.querySelector('.tasks');
    
    // Add tasks to the column
    tasks[column.id].forEach(task => {
      const taskEl = createTaskElement(task);
      tasksContainer.appendChild(taskEl);
    });
    
    // Add drag and drop event listeners to the column
    tasksContainer.addEventListener('dragover', handleDragOver);
    tasksContainer.addEventListener('drop', handleDrop);
  });
  
  // Add event listeners to add task buttons
  document.querySelectorAll('.add-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const columnId = btn.dataset.column;
      openAddTaskModal(columnId);
    });
  });
}

// Create a task element
function createTaskElement(task) {
  const taskEl = document.createElement('div');
  taskEl.className = `task ${task.isBigThree ? 'big-three' : ''}`;
  taskEl.dataset.id = task.id;
  taskEl.draggable = true;
  
  // Check if due date is within 3 days
  let dueDateClass = '';
  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    
    // Reset hours to compare dates only
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // Calculate difference in milliseconds and convert to days
    const timeDiff = dueDate.getTime() - today.getTime();
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (dayDiff <= 3 && dayDiff >= 0) {
      dueDateClass = 'due-soon';
    } else if (dayDiff < 0) {
      dueDateClass = 'overdue';
    }
  }
  
  taskEl.innerHTML = `
    <div class="task-header">
      <div class="task-title">${task.title}</div>
    </div>
    ${task.dueDate ? `<div class="task-due-date ${dueDateClass}">Due: ${formatDate(task.dueDate)}</div>` : ''}
  `;
  
  // Add event listeners
  taskEl.addEventListener('click', openEditTaskModal.bind(null, task));
  
  // Drag events
  taskEl.addEventListener('dragstart', handleDragStart);
  taskEl.addEventListener('dragend', handleDragEnd);
  
  // Add dragover listener to detect when hovering over this task
  taskEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    
    // We'll highlight the drop target
    const allTasks = document.querySelectorAll('.task');
    allTasks.forEach(t => t.classList.remove('drop-target-above', 'drop-target-below'));
    
    // Determine if we're in the upper or lower half of the task
    const rect = taskEl.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    
    if (e.clientY < midY) {
      taskEl.classList.add('drop-target-above');
    } else {
      taskEl.classList.add('drop-target-below');
    }
  });
  
  return taskEl;
}

// Render completed tasks
function renderCompletedTasks() {
  completedList.innerHTML = '';
  
  if (completedTasks.length === 0) {
    completedList.innerHTML = '<p>No completed tasks yet.</p>';
    return;
  }
  
  completedTasks.forEach(task => {
    const completedItem = document.createElement('div');
    completedItem.className = 'completed-item';
    
    completedItem.innerHTML = `
      <div class="completed-task-row">
        <span class="completed-title">${task.title}</span>
        <div class="completed-info">
          <span class="completed-date">Completed: ${formatDate(task.completedAt)}</span>
          <button class="restore-btn" data-id="${task.id}">Restore</button>
        </div>
      </div>
    `;
    
    completedList.appendChild(completedItem);
  });
  
  // Add event listeners to restore buttons
  document.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.dataset.id;
      restoreTask(taskId);
    });
  });
}

// Toggle between board and completed tasks view
function toggleCompletedTasksView() {
  const isShowingCompleted = !kanbanBoard.classList.contains('hidden');
  
  if (isShowingCompleted) {
    kanbanBoard.classList.add('hidden');
    completedTasksView.classList.remove('hidden');
    viewCompletedBtn.textContent = 'Back to Board';
    renderCompletedTasks();
  } else {
    kanbanBoard.classList.remove('hidden');
    completedTasksView.classList.add('hidden');
    viewCompletedBtn.textContent = 'View Completed Tasks';
  }
}

// Open task modal in add mode
function openAddTaskModal(columnId) {
  currentTask = {
    id: generateId(),
    title: '',
    description: '',
    dueDate: '',
    column: columnId,
    isBigThree: false,
    isNew: true
  };
  
  modalTitle.textContent = 'Add New Task';
  taskTitleInput.value = '';
  taskDescriptionInput.value = '';
  taskDueDateInput.value = '';
  
  // Create column selector
  createColumnSelector(columnId);
  
  taskBigThreeCheckbox.checked = false;
  
  deleteTaskBtn.style.display = 'none';
  completeTaskBtn.style.display = 'none';
  
  taskModal.classList.remove('hidden');
  
  // Focus on the title input when modal opens
  setTimeout(() => {
    taskTitleInput.focus();
  }, 100);
}

// Open task modal in edit mode
function openEditTaskModal(task) {
  currentTask = { ...task }; // Create a deep copy of the task to avoid reference issues
  
  modalTitle.textContent = 'Edit Task';
  taskTitleInput.value = task.title;
  taskDescriptionInput.value = task.description || '';
  
  // Handle date conversion properly
  if (task.dueDate) {
    // Convert ISO string to local date format for input
    const dueDate = new Date(task.dueDate);
    const year = dueDate.getFullYear();
    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
    const day = String(dueDate.getDate()).padStart(2, '0');
    taskDueDateInput.value = `${year}-${month}-${day}`;
  } else {
    taskDueDateInput.value = '';
  }
  
  // Create column selector
  createColumnSelector(task.column);
  
  taskBigThreeCheckbox.checked = task.isBigThree;
  
  deleteTaskBtn.style.display = 'block';
  completeTaskBtn.style.display = 'block';
  
  taskModal.classList.remove('hidden');
  
  // Focus on the title input when modal opens
  setTimeout(() => {
    taskTitleInput.focus();
  }, 100);
}

// Create column selector
function createColumnSelector(currentColumnId) {
  // Create a select element
  const select = document.createElement('select');
  select.id = 'column-selector';
  select.className = 'column-selector';
  
  // Add options for each column
  columns.forEach(column => {
    const option = document.createElement('option');
    option.value = column.id;
    option.textContent = column.title;
    option.selected = column.id === currentColumnId;
    select.appendChild(option);
  });
  
  // Clear existing content
  taskColumnDisplay.innerHTML = '';
  
  // Add the select element
  taskColumnDisplay.appendChild(select);
}

// Close the task modal
function closeTaskModal() {
  taskModal.classList.add('hidden');
  currentTask = null;
}

// Save a task to Firestore
async function saveTask(e) {
  e.preventDefault();
  
  if (!currentTask) return;

  // Show loading state
  const saveBtn = taskForm.querySelector('button[type="submit"]');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  try {
    // Get due date value and handle it properly
    let dueDate = '';
    if (taskDueDateInput.value) {
      // Create a date object in local timezone
      const localDate = new Date(taskDueDateInput.value);
      dueDate = localDate.toISOString();
    }
    
    // Get the selected column
    const columnSelector = document.getElementById('column-selector');
    const selectedColumn = columnSelector.value;
    
    const updatedTask = {
      title: taskTitleInput.value,
      description: taskDescriptionInput.value,
      dueDate: dueDate,
      column: selectedColumn,
      isBigThree: taskBigThreeCheckbox.checked,
      updatedAt: new Date().toISOString()
    };
    
    if (currentTask.isNew) {
      // Add new task to Firestore
      const tasksCollection = window.firestore.collection(window.db, `users/${userId}/tasks`);
      const docRef = await window.firestore.addDoc(tasksCollection, updatedTask);
      
      // Update local data
      updatedTask.id = docRef.id;
      tasks[updatedTask.column].push(updatedTask);
    } else {
      // Update existing task in Firestore
      const taskDoc = window.firestore.doc(window.db, `users/${userId}/tasks/${currentTask.id}`);
      await window.firestore.updateDoc(taskDoc, updatedTask);
      
      // Update local data
      // Remove the task from its current column first
      tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
      
      // Add updated task to the potentially new column
      updatedTask.id = currentTask.id;
      tasks[updatedTask.column].push(updatedTask);
    }
    
    // Also save to localStorage as a backup
    saveDataToLocalStorage();
    
    renderBoard();
    closeTaskModal();
    
    showNotification('Task saved successfully!', 'success');
  } catch (error) {
    console.error("Error saving task:", error);
    
    // Fallback to just using localStorage
    if (currentTask.isNew) {
      const newId = generateId();
      const newTask = {
        ...currentTask,
        id: newId,
        title: taskTitleInput.value,
        description: taskDescriptionInput.value,
        dueDate: taskDueDateInput.value ? new Date(taskDueDateInput.value).toISOString() : '',
        isBigThree: taskBigThreeCheckbox.checked
      };
      delete newTask.isNew;
      
      tasks[newTask.column].push(newTask);
    } else {
      // Remove task from its current column
      tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
      
      // Add the updated task to the selected column
      const updatedTask = {
        ...currentTask,
        title: taskTitleInput.value,
        description: taskDescriptionInput.value,
        dueDate: taskDueDateInput.value ? new Date(taskDueDateInput.value).toISOString() : '',
        column: selectedColumn,
        isBigThree: taskBigThreeCheckbox.checked
      };
      
      tasks[updatedTask.column].push(updatedTask);
    }
    
    saveDataToLocalStorage();
    
    renderBoard();
    closeTaskModal();
    
    showNotification('Error saving to database. Saved locally instead.', 'error');
  } finally {
    // Restore button state
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

// Delete a task
async function deleteTask() {
  if (!currentTask) return;
  
  if (!confirm("Are you sure you want to delete this task?")) {
    return;
  }
  
  try {
    const taskDoc = window.firestore.doc(window.db, `users/${userId}/tasks/${currentTask.id}`);
    
    // Delete from Firestore
    await window.firestore.deleteDoc(taskDoc);
    
    // Update local data
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
    
    // Also update localStorage
    saveDataToLocalStorage();
    
    renderBoard();
    closeTaskModal();
    
    showNotification('Task deleted successfully!', 'success');
  } catch (error) {
    console.error("Error deleting task:", error);
    
    // Fallback to just using localStorage
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
    saveDataToLocalStorage();
    
    renderBoard();
    closeTaskModal();
    
    showNotification('Error deleting from database. Deleted locally instead.', 'error');
  }
}

// Complete a task
async function completeTask() {
  if (!currentTask) return;
  
  try {
    // Add to completed tasks in Firestore
    const completedTask = {
      ...currentTask,
      completedAt: new Date().toISOString()
    };
    
    // Remove isNew property if it exists
    delete completedTask.isNew;
    
    // Add to completed tasks collection
    const completedTasksCollection = window.firestore.collection(window.db, `users/${userId}/completedTasks`);
    const docRef = await window.firestore.addDoc(completedTasksCollection, completedTask);
    
    // Delete from active tasks
    const taskDoc = window.firestore.doc(window.db, `users/${userId}/tasks/${currentTask.id}`);
    await window.firestore.deleteDoc(taskDoc);
    
    // Update local data
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
    
    completedTask.id = docRef.id; // Use the new document ID
    completedTasks.unshift(completedTask);
    
    // Update localStorage as backup
    saveDataToLocalStorage();
    
    renderBoard();
    closeTaskModal();
    
    showNotification('Task completed!', 'success');
  } catch (error) {
    console.error("Error completing task:", error);
    
    // Fallback to localStorage
    const completedTask = {
      ...currentTask,
      completedAt: new Date().toISOString(),
    };
    delete completedTask.isNew;
    
    // Update local data
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
    completedTasks.unshift(completedTask);
    
    // Update localStorage
    saveDataToLocalStorage();
    
    renderBoard();
    closeTaskModal();
    
    showNotification('Error updating database. Task completed locally instead.', 'error');
  }
}

// Restore a completed task
async function restoreTask(taskId) {
  // Find the task in the completed tasks
  const taskIndex = completedTasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) return;
  
  // Get the task
  const task = completedTasks[taskIndex];
  
  try {
    // Remove completedAt property and id for the new document
    const { completedAt, id, ...restoredTask } = task;
    
    // Add back to active tasks in Firestore
    const tasksCollection = window.firestore.collection(window.db, `users/${userId}/tasks`);
    const docRef = await window.firestore.addDoc(tasksCollection, restoredTask);
    
    // Delete from completed tasks in Firestore
    const completedTaskDoc = window.firestore.doc(window.db, `users/${userId}/completedTasks/${task.id}`);
    await window.firestore.deleteDoc(completedTaskDoc);
    
    // Update local data
    restoredTask.id = docRef.id;
    tasks[restoredTask.column].push(restoredTask);
    completedTasks.splice(taskIndex, 1);
    
    // Update localStorage as backup
    saveDataToLocalStorage();
    
    // Render both views to update UI
    renderCompletedTasks();
    renderBoard();
    
    // If we're in the completed tasks view, show a notification
    if (kanbanBoard.classList.contains('hidden')) {
      showNotification(`"${restoredTask.title}" restored to ${getColumnTitle(restoredTask.column)}`, 'success');
    } else {
      // If we're already on the board view, scroll to the restored task
      setTimeout(() => {
        const restoredTaskElement = document.querySelector(`.task[data-id="${restoredTask.id}"]`);
        if (restoredTaskElement) {
          restoredTaskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          restoredTaskElement.classList.add('highlight-restored');
          setTimeout(() => {
            restoredTaskElement.classList.remove('highlight-restored');
          }, 2000);
        }
      }, 100);
    }
  } catch (error) {
    console.error("Error restoring task:", error);
    
    // Fallback to localStorage
    const { completedAt, ...restoredTask } = task;
    tasks[restoredTask.column].push(restoredTask);
    completedTasks.splice(taskIndex, 1);
    
    // Update localStorage
    saveDataToLocalStorage();
    
    renderCompletedTasks();
    renderBoard();
    
    showNotification('Error updating database. Task restored locally instead.', 'error');
  }
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 3000);
}

// Drag and drop handlers
function handleDragStart(e) {
  const taskId = e.target.dataset.id;
  const columnId = e.target.closest('.tasks').dataset.column;
  
  draggedTask = {
    id: taskId,
    columnId: columnId
  };
  
  e.target.classList.add('dragging');
  
  // Add dragover and dragleave event listeners to the document 
  // for the duration of the drag operation
  document.addEventListener('dragover', handleDocumentDragOver);
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  
  // Remove drag-over class from all columns
  document.querySelectorAll('.column').forEach(col => {
    col.classList.remove('drag-over');
  });
  
  // Remove any task drop indicators
  document.querySelectorAll('.task').forEach(task => {
    task.classList.remove('drop-target-above', 'drop-target-below');
  });
  
  // Remove the document event listener when drag ends
  document.removeEventListener('dragover', handleDocumentDragOver);
}

function handleDocumentDragOver(e) {
  // If we're not over a tasks container, clear all column highlights
  if (!e.target.closest('.tasks')) {
    document.querySelectorAll('.column').forEach(col => {
      col.classList.remove('drag-over');
    });
    
    // Also clear any task drop indicators
    document.querySelectorAll('.task').forEach(task => {
      task.classList.remove('drop-target-above', 'drop-target-below');
    });
  }
}

function handleDragOver(e) {
  e.preventDefault();
  
  // Remove 'drag-over' class from all columns first
  document.querySelectorAll('.column').forEach(col => {
    col.classList.remove('drag-over');
  });

  // Add 'drag-over' class only to the current column
  e.currentTarget.closest('.column').classList.add('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  
  const targetColumnId = e.currentTarget.dataset.column;
  
  // Remove drag-over class from all columns
  document.querySelectorAll('.column').forEach(col => {
    col.classList.remove('drag-over');
  });
  
  if (!draggedTask) return;
  
  try {
    // Get the source column tasks
    const sourceColumnTasks = tasks[draggedTask.columnId];
    const taskIndex = sourceColumnTasks.findIndex(t => t.id === draggedTask.id);
    
    if (taskIndex === -1) return;
    
    // Get the task that's being moved
    const taskToMove = sourceColumnTasks[taskIndex];
    
    // Remove the task from its original position
    sourceColumnTasks.splice(taskIndex, 1);
    
    // Determine if we're changing columns
    const isSameColumn = draggedTask.columnId === targetColumnId;
    
    // Determine the target position within the column
    let targetPosition = -1;
    
    // Get the element being dropped on
    const dropTarget = e.target.closest('.task');
    
    if (dropTarget) {
      const targetTaskId = dropTarget.dataset.id;
      const targetTasks = tasks[targetColumnId];
      targetPosition = targetTasks.findIndex(t => t.id === targetTaskId);
      
      // If dropping below the middle of the target task, insert after it
      if (e.clientY > dropTarget.getBoundingClientRect().top + dropTarget.offsetHeight / 2) {
        targetPosition++;
      }
    }
    
    // If we're changing columns, update the column property
    if (!isSameColumn) {
      taskToMove.column = targetColumnId;
      
      // Update in Firestore
      const taskDoc = window.firestore.doc(window.db, `users/${userId}/tasks/${taskToMove.id}`);
      await window.firestore.updateDoc(taskDoc, { 
        column: targetColumnId,
        updatedAt: new Date().toISOString()
      });
    }
    
    // Add the task at the correct position
    if (targetPosition !== -1) {
      tasks[targetColumnId].splice(targetPosition, 0, taskToMove);
    } else {
      // If no specific target, add to the end
      tasks[targetColumnId].push(taskToMove);
    }
    
    // Update localStorage as backup
    saveDataToLocalStorage();
    
    // Clean up event listeners
    document.removeEventListener('dragover', handleDocumentDragOver);
    
    renderBoard();
  } catch (error) {
    console.error("Error updating task position:", error);
    
    // Fallback to just updating locally
    const sourceColumnTasks = tasks[draggedTask.columnId];
    const taskIndex = sourceColumnTasks.findIndex(t => t.id === draggedTask.id);
    
    if (taskIndex === -1) return;
    
    const taskToMove = sourceColumnTasks[taskIndex];
    sourceColumnTasks.splice(taskIndex, 1);
    
    // If changing columns, update the column property
    if (draggedTask.columnId !== targetColumnId) {
      taskToMove.column = targetColumnId;
    }
    
    tasks[targetColumnId].push(taskToMove);
    
    saveDataToLocalStorage();
    
    document.removeEventListener('dragover', handleDocumentDragOver);
    
    renderBoard();
    
    showNotification('Error updating database. Changes saved locally instead.', 'error');
  }
}

// Add CSS for notifications
function addNotificationStyles() {
  const notificationCSS = `
    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: var(--success);
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      animation: slide-in 0.3s ease-out forwards;
    }
    
    .notification.error {
      background-color: var(--danger);
    }
    
    @keyframes slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    .notification.fade-out {
      animation: fade-out 0.5s ease-out forwards;
    }
    
    @keyframes fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    .loading {
      text-align: center;
      padding: 2rem;
      color: var(--text-dim);
      font-size: 1.2rem;
    }
    
    .highlight-restored {
      animation: highlight-pulse 2s ease-in-out;
    }
    
    @keyframes highlight-pulse {
      0% { box-shadow: 0 0 0 0 rgba(51, 204, 51, 0.7); }
      50% { box-shadow: 0 0 0 10px rgba(51, 204, 51, 0); }
      100% { box-shadow: 0 0 0 0 rgba(51, 204, 51, 0); }
    }
  `;
  
  const style = document.createElement('style');
  style.textContent = notificationCSS;
  document.head.appendChild(style);
}

// Event listeners
function setupEventListeners() {
  viewCompletedBtn.addEventListener('click', toggleCompletedTasksView);
  taskForm.addEventListener('submit', saveTask);
  deleteTaskBtn.addEventListener('click', deleteTask);
  completeTaskBtn.addEventListener('click', completeTask);
  closeModalBtn.addEventListener('click', closeTaskModal);
  
  // Make the date field show the calendar when clicked
  taskDueDateInput.addEventListener('click', function() {
    // This forces the calendar to show by triggering the click event programmatically
    this.showPicker();
  });
  
  // Close modal when clicking outside
  taskModal.addEventListener('click', function(event) {
    // If the click was directly on the modal background (not on its children)
    if (event.target === taskModal) {
      closeTaskModal();
    }
  });
}

// Initialize the app
function init() {
  // Add notification CSS
  addNotificationStyles();
  
  // Set up event listeners
  setupEventListeners();
  
  // Add a wrapper around the due date input and add a clear button
  const dueDateWrapper = document.createElement('div');
  dueDateWrapper.className = 'due-date-container';
  
  // Get the original due date input
  const originalDueDateInput = taskDueDateInput;
  
  // Create a clear button
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'clear-date-btn';
  clearBtn.innerHTML = '&times;';
  clearBtn.title = 'Clear due date';
  clearBtn.addEventListener('click', function() {
    originalDueDateInput.value = '';
  });
  
  // Replace the input with the wrapper
  originalDueDateInput.parentNode.replaceChild(dueDateWrapper, originalDueDateInput);
  
  // Add the input and button to the wrapper
  dueDateWrapper.appendChild(originalDueDateInput);
  dueDateWrapper.appendChild(clearBtn);
  
  // Load data from Firestore (or localStorage as fallback)
  loadData();
  
  // Add connection status indicator
  addConnectionStatus();
}

// Add connection status indicator
function addConnectionStatus() {
  // Create a connection status indicator
  const statusIndicator = document.createElement('div');
  statusIndicator.className = 'connection-status';
  statusIndicator.innerHTML = `
    <span class="status-dot online"></span>
    <span class="status-text">Online</span>
  `;
  document.querySelector('header').appendChild(statusIndicator);
  
  // Add CSS for connection status
  const connectionCSS = `
    .connection-status {
      display: flex;
      align-items: center;
      font-size: 0.8rem;
      color: var(--text-dim);
      margin-left: auto;
      margin-right: 1rem;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }
    
    .status-dot.online {
      background-color: var(--success);
    }
    
    .status-dot.offline {
      background-color: var(--danger);
    }
  `;
  
  const style = document.createElement('style');
  style.textContent = connectionCSS;
  document.head.appendChild(style);
  
  // Listen for online/offline status changes
  window.addEventListener('online', () => {
    statusIndicator.innerHTML = `
      <span class="status-dot online"></span>
      <span class="status-text">Online</span>
    `;
    loadData(); // Refresh data when coming back online
  });
  
  window.addEventListener('offline', () => {
    statusIndicator.innerHTML = `
      <span class="status-dot offline"></span>
      <span class="status-text">Offline</span>
    `;
    showNotification('You are offline. Changes will be saved locally.', 'error');
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// Authentication Variables
let currentUser = null;

// Additional DOM elements for authentication
const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupConfirm = document.getElementById('signup-confirm');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');
const logoutBtn = document.getElementById('logout-btn');

// Toggle between login and signup forms
function toggleAuthForms() {
  loginForm.classList.toggle('hidden');
  signupForm.classList.toggle('hidden');
}

// Handle login
async function handleLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  
  // Basic validation
  if (!email || !password) {
    loginError.textContent = 'Please enter both email and password';
    return;
  }
  
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  loginError.textContent = '';
  
  try {
    const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(window.auth, email, password);
    currentUser = userCredential.user;
    
    // Reset form
    loginEmail.value = '';
    loginPassword.value = '';
    
    // Show main app
    authContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    
    // Load user's tasks
    loadData();
  } catch (error) {
    console.error('Login error:', error);
    
    // Display appropriate error message
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      loginError.textContent = 'Invalid email or password';
    } else if (error.code === 'auth/too-many-requests') {
      loginError.textContent = 'Too many failed login attempts. Please try again later.';
    } else {
      loginError.textContent = 'Error signing in. Please try again.';
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

// Handle signup
async function handleSignup() {
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirmPassword = signupConfirm.value;
  
  // Basic validation
  if (!email || !password) {
    signupError.textContent = 'Please enter both email and password';
    return;
  }
  
  if (password !== confirmPassword) {
    signupError.textContent = 'Passwords do not match';
    return;
  }
  
  if (password.length < 6) {
    signupError.textContent = 'Password must be at least 6 characters';
    return;
  }
  
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating account...';
  signupError.textContent = '';
  
  try {
    const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(window.auth, email, password);
    currentUser = userCredential.user;
    
    // Reset form
    signupEmail.value = '';
    signupPassword.value = '';
    signupConfirm.value = '';
    
    // Show main app
    authContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    
    // Initialize empty tasks for new user
    initializeUserTasks();
  } catch (error) {
    console.error('Signup error:', error);
    
    // Display appropriate error message
    if (error.code === 'auth/email-already-in-use') {
      signupError.textContent = 'This email is already in use';
    } else if (error.code === 'auth/invalid-email') {
      signupError.textContent = 'Please enter a valid email address';
    } else if (error.code === 'auth/weak-password') {
      signupError.textContent = 'Password is too weak';
    } else {
      signupError.textContent = 'Error creating account. Please try again.';
    }
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
}

// Initialize empty task collections for new users
async function initializeUserTasks() {
  if (!currentUser) return;
  
  // Initialize empty tasks object with all columns
  tasks = {};
  columns.forEach(column => {
    tasks[column.id] = [];
  });
  
  completedTasks = [];
  
  // Save to localStorage as backup
  saveDataToLocalStorage();
  
  // Render empty board
  renderBoard();
  
  showNotification('Welcome! Start by adding your first task.', 'success');
}

// Handle logout
async function handleLogout() {
  try {
    await window.firebaseAuth.signOut(window.auth);
    
    // Reset app state
    currentUser = null;
    tasks = {};
    completedTasks = [];
    
    // Show login screen
    mainContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    
    // Show login form, hide signup form
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    
    showNotification('Logged out successfully', 'success');
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Error logging out', 'error');
  }
}

// Auth state observer
function setupAuthObserver() {
  window.firebaseAuth.onAuthStateChanged(window.auth, (user) => {
    if (user) {
      // User is signed in
      currentUser = user;
      userId = user.uid; // Update the userId to be the user's Firebase UID
      
      // Show main app
      authContainer.classList.add('hidden');
      mainContainer.classList.remove('hidden');
      
      // Load user's tasks
      loadData();
    } else {
      // User is signed out
      currentUser = null;
      
      // Show login screen
      mainContainer.classList.add('hidden');
      authContainer.classList.remove('hidden');
    }
  });
}

// Add auth event listeners
function setupAuthEventListeners() {
  showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthForms();
  });
  
  showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthForms();
  });
  
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogin();
  });
  
  signupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleSignup();
  });
  
  logoutBtn.addEventListener('click', handleLogout);
}

// Update loadData to use current user's ID
async function loadData() {
  try {
    // Show loading indicator
    kanbanBoard.innerHTML = '<div class="loading">Loading your tasks...</div>';
    
    // Ensure we have a user
    if (!currentUser) {
      return;
    }
    
    userId = currentUser.uid;
    
    // Initialize empty tasks object with all columns
    tasks = {};
    columns.forEach(column => {
      tasks[column.id] = [];
    });
    
    // Get tasks from Firestore
    const tasksCollection = window.firestore.collection(window.db, `users/${userId}/tasks`);
    const snapshot = await window.firestore.getDocs(tasksCollection);
    
    snapshot.forEach(doc => {
      const task = doc.data();
      task.id = doc.id; // Use Firestore document ID as task ID
      if (tasks[task.column]) {
        tasks[task.column].push(task);
      }
    });
    
    // Get completed tasks
    const completedTasksCollection = window.firestore.collection(window.db, `users/${userId}/completedTasks`);
    const completedSnapshot = await window.firestore.getDocs(completedTasksCollection);
    
    completedTasks = [];
    completedSnapshot.forEach(doc => {
      const task = doc.data();
      task.id = doc.id;
      completedTasks.push(task);
    });
    
    // Sort completed tasks by completedAt date (newest first)
    completedTasks.sort((a, b) => {
      return new Date(b.completedAt) - new Date(a.completedAt);
    });
    
    // Show the board
    renderBoard();
  } catch (error) {
    console.error("Error loading data:", error);
    
    // Fall back to localStorage if Firestore fails
    const savedTasks = localStorage.getItem(`kanban-tasks-${userId}`);
    const savedCompletedTasks = localStorage.getItem(`kanban-completed-tasks-${userId}`);
    
    tasks = savedTasks ? JSON.parse(savedTasks) : {};
    completedTasks = savedCompletedTasks ? JSON.parse(savedCompletedTasks) : [];
    
    // Initialize empty arrays for any missing columns
    columns.forEach(column => {
      if (!tasks[column.id]) {
        tasks[column.id] = [];
      }
    });
    
    renderBoard();
    
    showNotification('Error loading from database. Using local data instead.', 'error');
  }
}

// Update saveDataToLocalStorage to use current user's ID
function saveDataToLocalStorage() {
  if (currentUser) {
    localStorage.setItem(`kanban-tasks-${currentUser.uid}`, JSON.stringify(tasks));
    localStorage.setItem(`kanban-completed-tasks-${currentUser.uid}`, JSON.stringify(completedTasks));
  }
}

// Update the init function to set up auth
function init() {
  // Add notification CSS
  addNotificationStyles();
  
  // Set up regular event listeners
  setupEventListeners();
  
  // Set up authentication listeners
  setupAuthEventListeners();
  
  // Set up auth state observer
  setupAuthObserver();
  
  // Add a wrapper around the due date input and add a clear button
  const dueDateWrapper = document.createElement('div');
  dueDateWrapper.className = 'due-date-container';
  
  // Get the original due date input
  const originalDueDateInput = taskDueDateInput;
  
  // Create a clear button
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'clear-date-btn';
  clearBtn.innerHTML = '&times;';
  clearBtn.title = 'Clear due date';
  clearBtn.addEventListener('click', function() {
    originalDueDateInput.value = '';
  });
  
  // Replace the input with the wrapper
  originalDueDateInput.parentNode.replaceChild(dueDateWrapper, originalDueDateInput);
  
  // Add the input and button to the wrapper
  dueDateWrapper.appendChild(originalDueDateInput);
  dueDateWrapper.appendChild(clearBtn);
  
  // Add connection status indicator
  addConnectionStatus();
}