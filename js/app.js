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
  }// Define the columns
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
  
  // Load data from localStorage
  function loadData() {
    const savedTasks = localStorage.getItem('kanban-tasks');
    const savedCompletedTasks = localStorage.getItem('kanban-completed-tasks');
    
    tasks = savedTasks ? JSON.parse(savedTasks) : {};
    completedTasks = savedCompletedTasks ? JSON.parse(savedCompletedTasks) : [];
    
    // Initialize empty arrays for any missing columns
    columns.forEach(column => {
      if (!tasks[column.id]) {
        tasks[column.id] = [];
      }
    });
  }
  
  // Save data to localStorage
  function saveData() {
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
    
    // Create column selector instead of just displaying it
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
  
  // Close the task modal
  function closeTaskModal() {
    taskModal.classList.add('hidden');
    currentTask = null;
  }
  
  // Save a task
  function saveTask(e) {
    e.preventDefault();
    
    if (!currentTask) return;
  
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
      ...currentTask,
      title: taskTitleInput.value,
      description: taskDescriptionInput.value,
      dueDate: dueDate,
      column: selectedColumn,
      isBigThree: taskBigThreeCheckbox.checked
    };
    
    // Remove isNew flag if present
    delete updatedTask.isNew;
    
    if (currentTask.isNew) {
      tasks[updatedTask.column].push(updatedTask);
    } else {
      // Remove the task from its current column first
      tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
      
      // Then add the updated task to the potentially new column
      tasks[updatedTask.column].push(updatedTask);
    }
    
    saveData();
    renderBoard();
    closeTaskModal();
  }
  
  // Delete a task
  function deleteTask() {
    if (!currentTask) return;
    
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
    
    saveData();
    renderBoard();
    closeTaskModal();
  }
  
  // Complete a task
  function completeTask() {
    if (!currentTask) return;
    
    // Remove from active tasks
    tasks[currentTask.column] = tasks[currentTask.column].filter(t => t.id !== currentTask.id);
    
    // Add to completed tasks
    const completedTask = {
      ...currentTask,
      completedAt: new Date().toISOString()
    };
    
    completedTasks.unshift(completedTask);
    
    saveData();
    renderBoard();
    closeTaskModal();
  }
  
  // Restore a completed task
  function restoreTask(taskId) {
    // Find the task in the completed tasks
    const taskIndex = completedTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return;
    
    // Get the task
    const task = completedTasks[taskIndex];
    
    // Remove completedAt property
    const { completedAt, ...restoredTask } = task;
    
    // Add back to active tasks
    tasks[restoredTask.column].push(restoredTask);
    
    // Remove from completed tasks
    completedTasks.splice(taskIndex, 1);
    
    saveData();
    
    // Render both views to update UI
    renderCompletedTasks();
    renderBoard();
    
    // If we're in the completed tasks view, show a notification
    if (kanbanBoard.classList.contains('hidden')) {
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = `"${restoredTask.title}" restored to ${getColumnTitle(restoredTask.column)}`;
      
      document.body.appendChild(notification);
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 500);
      }, 3000);
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
  
  // New function to handle dragover events at the document level
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
  
  function handleDrop(e) {
    e.preventDefault();
    
    const targetColumnId = e.currentTarget.dataset.column;
    
    // Remove drag-over class from all columns
    document.querySelectorAll('.column').forEach(col => {
      col.classList.remove('drag-over');
    });
    
    if (!draggedTask) return;
    
    // Get the source column tasks
    const sourceColumnTasks = tasks[draggedTask.columnId];
    const taskIndex = sourceColumnTasks.findIndex(t => t.id === draggedTask.id);
    
    if (taskIndex === -1) return;
    
    // Get the task that's being moved
    const taskToMove = sourceColumnTasks[taskIndex];
    
    // Remove the task from its original position
    sourceColumnTasks.splice(taskIndex, 1);
    
    // Determine the target position within the column
    let targetPosition = -1;
    
    // Get the element being dropped on
    const dropTarget = e.target.closest('.task');
    
    if (draggedTask.columnId === targetColumnId) {
      // Same column reordering
      if (dropTarget) {
        const targetTaskId = dropTarget.dataset.id;
        const targetTasks = tasks[targetColumnId];
        targetPosition = targetTasks.findIndex(t => t.id === targetTaskId);
        
        // If dropping below the middle of the target task, insert after it
        if (e.clientY > dropTarget.getBoundingClientRect().top + dropTarget.offsetHeight / 2) {
          targetPosition++;
        }
      }
      
      // Update task in the same column (reordering)
      if (targetPosition !== -1) {
        tasks[targetColumnId].splice(targetPosition, 0, taskToMove);
      } else {
        // If no specific target, add to the end
        tasks[targetColumnId].push(taskToMove);
      }
    } else {
      // Different column
      // Update the column value
      const updatedTask = {
        ...taskToMove,
        column: targetColumnId
      };
      
      // If dropping on a specific task, insert at that position
      if (dropTarget) {
        const targetTaskId = dropTarget.dataset.id;
        const targetTasks = tasks[targetColumnId];
        targetPosition = targetTasks.findIndex(t => t.id === targetTaskId);
        
        // If dropping below the middle of the target task, insert after it
        if (e.clientY > dropTarget.getBoundingClientRect().top + dropTarget.offsetHeight / 2) {
          targetPosition++;
        }
        
        if (targetPosition !== -1) {
          tasks[targetColumnId].splice(targetPosition, 0, updatedTask);
        } else {
          tasks[targetColumnId].push(updatedTask);
        }
      } else {
        // If no specific target, add to the end
        tasks[targetColumnId].push(updatedTask);
      }
    }
    
    // Clean up event listeners
    document.removeEventListener('dragover', handleDocumentDragOver);
    
    saveData();
    renderBoard();
  }
  
  // Add CSS classes for due dates, drag/drop styling, task count, form elements, and notifications
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .task-due-date.due-soon {
      color: #ffff00 !important; /* Neon yellow */
      font-weight: bold;
    }
    
    .task-due-date.overdue {
      color: #ff3333 !important; /* Red */
      font-weight: bold;
    }
    
    .big-three .task-due-date.due-soon {
      color: #ff8800 !important; /* Orange for big three */
      font-weight: bold;
    }
    
    .big-three .task-due-date.overdue {
      color: #ff3333 !important; /* Red for big three */
      font-weight: bold;
    }
    
    /* Drag and drop indicators */
    .task.drop-target-above {
      border-top: 2px solid var(--primary);
    }
    
    .task.drop-target-below {
      border-bottom: 2px solid var(--primary);
    }
    
    /* Visual feedback during drag */
    .task.dragging {
      opacity: 0.6;
      transform: scale(0.98);
      box-shadow: 0 5px 10px rgba(0, 0, 0, 0.5);
    }
    
    /* Cursor style for tasks */
    .task {
      cursor: pointer;
    }
    
    /* Task count styling */
    .task-count {
      background-color: var(--bg-card);
      color: var(--text-dim);
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 0.8rem;
      margin-left: 8px;
      font-weight: normal;
    }
    
    /* Column selector styling */
    .column-selector {
      width: 100%;
      padding: 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      background-color: var(--bg-card);
      color: var(--text-light);
      font-family: inherit;
      outline: none; /* Remove the default focus outline */
      box-shadow: none; /* Remove any box shadow */
    }
    
    /* Remove the double border around the select when it's in a container */
    #task-column {
      padding: 0;
      border: none;
      background: none;
    }
    
    /* Due date field container */
    .due-date-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .clear-date-btn {
      background-color: var(--border-color);
      color: var(--text-light);
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      font-size: 16px;
      line-height: 1;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .clear-date-btn:hover {
      background-color: var(--danger);
    }
    
    /* Notification styling */
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
    
    /* Highlight restored task */
    .task.highlight-restored {
      animation: highlight-pulse 2s ease-in-out;
    }
    
    @keyframes highlight-pulse {
      0% { box-shadow: 0 0 0 0 rgba(51, 204, 51, 0.7); }
      50% { box-shadow: 0 0 0 10px rgba(51, 204, 51, 0); }
      100% { box-shadow: 0 0 0 0 rgba(51, 204, 51, 0); }
    }
  `;
  document.head.appendChild(styleElement);
  
  // Event listeners
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
  
  // Initialize the app
  function init() {
    loadData();
    renderBoard();
    
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
  }
  
  // Start the app
  document.addEventListener('DOMContentLoaded', init);