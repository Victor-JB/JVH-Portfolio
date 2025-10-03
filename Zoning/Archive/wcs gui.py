import tkinter as tk
from tkinter import ttk

def combo1_selected(event):
    selected_value = combo1.get()

    # Update combo2 options based on combo1 selection
    if selected_value == "125":
        combo2['values'] = ["15", "30"]
    else:
        combo2['values'] = ["17.5","35"]
    combo2.config(state="readonly")

def combo2_selected(event):
    selected_value = combo2.get()
    if selected_value != None:
        combo3.config(state="readonly")

def validate_entry(text):
    if text is None or len(text) == 0:
        check_condition()
        return True
    # Check if the text can be converted to a float or integer
    try:
        float(text)
        check_condition()
        return True
    except ValueError:
        return False

def check_entry(*args):
    entry_text = entry.get()
    if entry_text and validate_float(entry_text) and combo3.get()!=None and (checkbox1_var.get()==1 or checkbox2_var.get()==1):
        submit_button.config(state="normal")
    else:
        submit_button.config(state="disabled")

def check_button_selected2(button):
    if button == 1:
        checkbox2.deselect()
    elif button == 2:
        checkbox1.deselect()
    check_entry()

import tkinter as tk
from tkinter import ttk

# def check_condition():
#     if combo3.get()!=None and (checkbox1_var.get()==1 or checkbox2_var.get()==1):
#         try :
#             len(entry.get())>0
#             print("Condition is met!")
#             submit_button.config(state=tk.NORMAL)
#     else:
#         submit_button.config(state=tk.DISABLED)
    # window.after(1000, check_condition)  # 1000ms = 1 second


def submit():
    # Retrieve values from combobox and text entry
    value1 = combo1.get()
    value2 = combo2.get()
    value3 = combo3.get()
    text_value = entry.get()

    # Retrieve checkbox values
    checkbox1_value = checkbox1_var.get()
    checkbox2_value = checkbox2_var.get()

    # Print the values
    print("Combo 1:", value1)
    print("Combo 2:", value2)
    print("Combo 3:", value3)

    print("aaaa")

    print("Text Entry:", text_value, type(text_value),print(text_value is None),print(len(text_value)))
    if text_value is not None:
        print(len(text_value))
    else:
        print("String is None")

    print("Checkbox 1:", checkbox1_value)
    print("Checkbox 2:", checkbox2_value)

# Create the main window
window = tk.Tk()
window.title("GUI Example")

# Create the labels for comboboxes
label1 = tk.Label(window, text="ExtruGrip Width")
label1.pack()

combo1 = ttk.Combobox(window, values=["125", "200"],state="readonly")
combo1.pack()
combo1.bind("<<ComboboxSelected>>", combo1_selected)

label2 = tk.Label(window, text="Pitch")
label2.pack()

combo2 = ttk.Combobox(window, values=["15","30","17.5","35"], state=tk.DISABLED,)
combo2.pack()
combo2.bind("<<ComboboxSelected>>", combo2_selected)

label3 = tk.Label(window, text="ExtruGrip Length")
label3.pack()

combo3 = ttk.Combobox(window, values=["250", "400", "600"], state=tk.DISABLED)
combo3.pack()

# Create the label for text entry
text_label = tk.Label(window, text="Product Width")
text_label.pack()

# Create the text entry
validate_float_int = window.register(validate_entry)
entry = tk.Entry(window, validate="key", validatecommand=(validate_float_int, '%P'))
entry.bind("<KeyRelease>", check_entry)
entry.pack()

# Create the checkboxes
checkbox1_var = tk.IntVar()
checkbox1 = tk.Checkbutton(window, text="Best Case Scenario", variable=checkbox1_var,command=lambda: check_button_selected2(1))
checkbox1.pack()

checkbox2_var = tk.IntVar()
checkbox2 = tk.Checkbutton(window, text="Worst Case Scenario", variable=checkbox2_var,command=lambda: check_button_selected2(2))
checkbox2.pack()

# Create the submit button
submit_button = tk.Button(window, text="Calculate", command=submit,state=tk.DISABLED)
submit_button.pack()

# Create labels below the button
label4 = tk.Label(window, text="Number of holes covered : ")
label4.pack()

label5 = tk.Label(window, text="_________")
label5.pack()

check_entry()
# window.after(1000, check_condition)

# Start the GUI main loop
window.mainloop()
