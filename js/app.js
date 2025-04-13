// Initialize the app
function init() {
  // Add notification CSS
  addNotificationStyles();
  
  // Set up all event listeners
  setupEventListeners();
  
  // Set up date input with clear button
  setupDateInput();
  
  // Set up auth state observer
  window.firebaseAuth.onAuthStateChanged(window.auth, (user) => {
    if (user) {
      // User is signed in
      currentUser = user;
      console.log("User signed in:", user.email);
      
      // Initialize empty tasks for all columns
      columns.forEach(column => {
        if (!tasks[column.id]) tasks[column.id] = [];
      });
      
      // Load user's tasks
      loadData();
    } else {
      // User is signed out, redirect to login page
      console.log("User is signed out");
      window.location.href = 'login.html';
    }
  });
}

// Start the app when the document is loaded
document.addEventListener('DOMContentLoaded', init);// Define the columns
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
let currentUser = null;

// DOM elements
const kanbanBoard = document.getElementById('kanban-board');
const completedTasksView = document.getElementById('completed-tasks');
const completedList = document.getElementById('completed-list');
const viewCompletedBtn = document.getElementById('view-completed');
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
const logoutBtn = document.getElementById('logout-btn');

// Load data from Firestore
async function loadData() {
  try {
    // Show loading indicator
    kanbanBoard.innerHTML = '<div class="loading">Loading your tasks...</div>';
    
    // Ensure we have a user
    if (!currentUser) {
      console.error("No user found when loading data");
      return;
    }
    
    // Initialize empty tasks object with all columns
    tasks = {};
    columns.forEach(column => {
      tasks[column.id] = [];
    });
    
    // Get tasks from Firestore
    const tasksCollection = window.firestore.collection(window.db, `users/${currentUser.uid}/tasks`);
    const snapshot = await window.firestore.getDocs(tasksCollection);
    
    snapshot.forEach(doc => {
      const task = doc.data();
      task.id = doc.id;
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
    completedTasks.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    
    // Show the board
    renderBoard();
  } catch (error) {
    console.error("Error loading data:", error);
    
    // Fall back to localStorage if Firestore fails
    if (currentUser) {
      const savedTasks = localStorage.getItem(`kanban-tasks-${currentUser.uid}`);
      const savedCompletedTasks = localStorage.getItem(`kanban-completed-tasks-${currentUser.uid}`);
      
      tasks = savedTasks ? JSON.parse(savedTasks) : {};
      completedTasks = savedCompletedTasks ? JSON.parse(savedCompletedTasks) : [];
      
      // Initialize empty arrays for any missing columns
      columns.forEach(column => {
        if (!tasks[column.id]) tasks[column.id] = [];
      });
      
      renderBoard();
      showNotification('Error loading from database. Using local data instead.', 'error');
    }
  }
}

// Save data to local storage (as backup)
function saveDataToLocalStorage() {
  if (currentUser) {
    localStorage.setItem(`kanban-tasks-${currentUser.uid}`, JSON.stringify(tasks));
    localStorage.setItem(`kanban-completed-tasks-${currentUser.uid}`, JSON.stringify(completedTasks));
  }
}

// Initialize empty task collections for new users
function initializeUserTasks() {
  if (!currentUser) return;
  
  // Initialize empty tasks object with all columns
  tasks = {};
  columns.forEach(column => tasks[column.id] = []);
  
  completedTasks = [];
  saveDataToLocalStorage();
  renderBoard();
  
  showNotification('Welcome! Start by adding your first task.', 'success');
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
    const taskCount = tasks[column.id] ? tasks[column.id].length : 0;
    
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
    if (tasks[column.id]) {
      tasks[column.id].forEach(task => {
        const taskEl = createTaskElement(task);
        tasksContainer.appendChild(taskEl);
      });
    }
    
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
  taskEl.addEventListener('click', () => openEditTaskModal(task));
  
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
  setTimeout(() => taskTitleInput.focus(), 100);
}

// Open task modal in edit mode
function openEditTaskModal(task) {
  currentTask = { ...task }; // Create a deep copy of the task
  
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
  setTimeout(() => taskTitleInput.focus(), 100);
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
  
  // Clear existing content and add the select element
  taskColumnDisplay.innerHTML = '';
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
  
  if (!currentUser || !currentTask) return;

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
      const tasksCollection = window.firestore.collection(window.db, `users/${currentUser.uid}/tasks`);
      const docRef = await window.firestore.addDoc(tasksCollection, updatedTask);
      
      // Update local data
      updatedTask.id = docRef.id;
      tasks[updatedTask.column].push(updatedTask);
    } else {
      // Update existing task in Firestore
      const taskDoc = window.firestore.doc(window.db, `users/${currentUser.uid}/tasks/${currentTask.id}`);
      await window.firestore.updateDoc(taskDoc, updatedTask);
      
      // Update local data - remove from current column and add to new one
      tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
      updatedTask.id = currentTask.id;
      tasks[updatedTask.column].push(updatedTask);
    }
    
    saveDataToLocalStorage();
    renderBoard();
    closeTaskModal();
    
    showNotification('Task saved successfully!', 'success');
  } catch (error) {
    console.error("Error saving task:", error);
    
    // Fallback to just using localStorage
    if (currentTask.isNew) {
      const newTask = {
        ...currentTask,
        id: generateId(),
        title: taskTitleInput.value,
        description: taskDescriptionInput.value,
        dueDate: taskDueDateInput.value ? new Date(taskDueDateInput.value).toISOString() : '',
        isBigThree: taskBigThreeCheckbox.checked
      };
      delete newTask.isNew;
      
      tasks[newTask.column].push(newTask);
    } else {
      // Update existing task locally
      const columnSelector = document.getElementById('column-selector');
      const selectedColumn = columnSelector.value;
      
      tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
      
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
  if (!currentUser || !currentTask) return;
  
  if (!confirm("Are you sure you want to delete this task?")) return;
  
  try {
    const taskDoc = window.firestore.doc(window.db, `users/${currentUser.uid}/tasks/${currentTask.id}`);
    await window.firestore.deleteDoc(taskDoc);
    
    // Update local data
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
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
  if (!currentUser || !currentTask) return;
  
  try {
    // Add to completed tasks in Firestore
    const completedTask = {
      ...currentTask,
      completedAt: new Date().toISOString()
    };
    delete completedTask.isNew;
    
    // Add to completed tasks collection
    const completedTasksCollection = window.firestore.collection(window.db, `users/${currentUser.uid}/completedTasks`);
    const docRef = await window.firestore.addDoc(completedTasksCollection, completedTask);
    
    // Delete from active tasks
    const taskDoc = window.firestore.doc(window.db, `users/${currentUser.uid}/tasks/${currentTask.id}`);
    await window.firestore.deleteDoc(taskDoc);
    
    // Update local data
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
    completedTask.id = docRef.id;
    completedTasks.unshift(completedTask);
    
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
    
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
    completedTasks.unshift(completedTask);
    
    saveDataToLocalStorage();
    renderBoard();
    closeTaskModal();
    
    showNotification('Error updating database. Task completed locally instead.', 'error');
  }
}

// Restore a completed task
async function restoreTask(taskId) {
  if (!currentUser) return;
  
  // Find the task in the completed tasks
  const taskIndex = completedTasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;
  
  // Get the task
  const task = completedTasks[taskIndex];
  
  try {
    // Remove completedAt property and id for the new document
    const { completedAt, id, ...restoredTask } = task;
    
    // Add back to active tasks in Firestore
    const tasksCollection = window.firestore.collection(window.db, `users/${currentUser.uid}/tasks`);
    const docRef = await window.firestore.addDoc(tasksCollection, restoredTask);
    
    // Delete from completed tasks in Firestore
    const completedTaskDoc = window.firestore.doc(window.db, `users/${currentUser.uid}/completedTasks/${task.id}`);
    await window.firestore.deleteDoc(completedTaskDoc);
    
    // Update local data
    restoredTask.id = docRef.id;
    tasks[restoredTask.column].push(restoredTask);
    completedTasks.splice(taskIndex, 1);
    
    saveDataToLocalStorage();
    
    // Render both views to update UI
    renderCompletedTasks();
    renderBoard();
    
    // Show appropriate notification based on current view
    if (kanbanBoard.classList.contains('hidden')) {
      showNotification(`"${restoredTask.title}" restored to ${getColumnTitle(restoredTask.column)}`, 'success');
    } else {
      // Highlight the restored task if we're on the board view
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
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Drag and drop handlers
function handleDragStart(e) {
  const taskId = e.target.dataset.id;
  const columnId = e.target.closest('.tasks').dataset.column;
  
  draggedTask = { id: taskId, columnId: columnId };
  e.target.classList.add('dragging');
  
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
  
  document.removeEventListener('dragover', handleDocumentDragOver);
}

function handleDocumentDragOver(e) {
  // If we're not over a tasks container, clear all highlights
  if (!e.target.closest('.tasks')) {
    document.querySelectorAll('.column').forEach(col => {
      col.classList.remove('drag-over');
    });
    
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
  
  if (!currentUser || !draggedTask) return;
  
  const targetColumnId = e.currentTarget.dataset.column;
  
  // Remove drag-over class from all columns
  document.querySelectorAll('.column').forEach(col => {
    col.classList.remove('drag-over');
  });
  
  try {
    // Get the source column tasks
    const sourceColumnTasks = tasks[draggedTask.columnId];
    const taskIndex = sourceColumnTasks.findIndex(t => t.id === draggedTask.id);
    
    if (taskIndex === -1) return;
    
    // Get the task being moved
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
      const taskDoc = window.firestore.doc(window.db, `users/${currentUser.uid}/tasks/${taskToMove.id}`);
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
    
    saveDataToLocalStorage();
    document.removeEventListener('dragover', handleDocumentDragOver);
    renderBoard();
  } catch (error) {
    console.error("Error updating task position:", error);
    
    // Fallback to local update
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
    renderBoard();
    
    showNotification('Error updating database. Changes saved locally instead.', 'error');
  }
}

// Set up date input with clear button
function setupDateInput() {
  // Add a wrapper around the due date input
  const dueDateWrapper = document.createElement('div');
  dueDateWrapper.className = 'due-date-container';
  
  // Get the original due date input and its parent
  const originalDueDateInput = taskDueDateInput;
  const parent = originalDueDateInput.parentNode;
  
  // Create a clear button
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'clear-date-btn';
  clearBtn.innerHTML = '&times;';
  clearBtn.title = 'Clear due date';
  clearBtn.addEventListener('click', () => {
    originalDueDateInput.value = '';
  });
  
  // Replace the input with the wrapper
  parent.replaceChild(dueDateWrapper, originalDueDateInput);
  
  // Add the input and button to the wrapper
  dueDateWrapper.appendChild(originalDueDateInput);
  dueDateWrapper.appendChild(clearBtn);
  
  // Make the date field show the calendar when clicked
  originalDueDateInput.addEventListener('click', function() {
    this.showPicker();
  });
}

// Handle logout
async function handleLogout() {
  try {
    await window.firebaseAuth.signOut(window.auth);
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Error logging out. Please try again.', 'error');
  }
}

// Set up event listeners
function setupEventListeners() {
  // Task form and modal event listeners
  taskForm.addEventListener('submit', saveTask);
  deleteTaskBtn.addEventListener('click', deleteTask);
  completeTaskBtn.addEventListener('click', completeTask);
  closeModalBtn.addEventListener('click', closeTaskModal);
  
  // View completed tasks button
  viewCompletedBtn.addEventListener('click', toggleCompletedTasksView);
  
  // Logout button
  logoutBtn.addEventListener('click', handleLogout);
  
  // Close modal when clicking outside
  taskModal.addEventListener('click', function(event) {
    if (event.target === taskModal) {
      closeTaskModal();
    }
  });
}

// Add notification CSS
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
  `;
  
  const style = document.createElement('style');
  style.textContent = notificationCSS;
  document.head.appendChild(style);
}