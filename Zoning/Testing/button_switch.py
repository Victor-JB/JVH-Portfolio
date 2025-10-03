import tkinter as tk

def toggle_check():
    if button1_var.get() == 1:
        button2_var.set(0)
        print('a')
    elif button2_var.get() == 1:
        button1_var.set(0)
        print('b')
# Create the main window
window = tk.Tk()
window.title("Check Button Example")

# Create variables to store the state of the check buttons
button1_var = tk.IntVar()
button2_var = tk.IntVar()

# Create the check buttons
button1 = tk.Checkbutton(window, text="1", variable=button1_var, command=toggle_check)
button1.pack()

button2 = tk.Checkbutton(window, text="2", variable=button2_var, command=toggle_check)
button2.pack()

# Start the GUI event loop
window.mainloop()

##
import tkinter as tk

def check_button_selected(button):
    if button == 1:
        button2.deselect()
    elif button == 2:
        button1.deselect()

def get_var():
        print(str(button1_var.get()))
        print(str(button2_var.get()))
# Create the main window
window = tk.Tk()
window.title("Check Button Example")

# Create variables to store the state of the check buttons
button1_var = tk.BooleanVar()
button2_var = tk.BooleanVar()

# Create the check buttons
button1 = tk.Checkbutton(window, text="1",variable=button1_var, command=lambda: check_button_selected(1))
button1.pack()

button2 = tk.Checkbutton(window, text="2",variable=button2_var, command=lambda: check_button_selected(2))
button2.pack()

get_button = tk.Button(window, text="Get Var", command=get_var)
get_button.pack()
# Start the GUI event loop
window.mainloop()