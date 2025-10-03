##Import
import numpy as np
import math
import tkinter as tk
from tkinter import ttk

##Center holes coordinates list
#In the US, Ethan calculated the best coordinates for the center holes of ecach row of the gripper in order to have the more holes as possible. Those two list are the vertical coordinates of the center hole for each row of the 200 wide and 125 wide ExtruGrip. The EtruGrip are then built using those coordinates :

# 200w=[57.189,35.994,14.169,7.656,-7.656,-14.169,-35.994,-57.189]
# 125w=[16.875, 5.625, -5.625, -16.875]

## Calculation fucntions
#The first part of this fucntion will add to the list trous_liste the number of holes of each row for the first half of the extrugrip using the list above, it will also count the total number of holes with the variable hole_num
def build_extrugrip(Length,pitch,width):
    if width == 125:
        center_offsets=[1.875,-5.625,5.625,-1.875]
        hole_num=4
    else:
        center_offsets=[57.189,35.994,14.169,7.656,-7.656,-14.169,-35.994,-57.189]
        hole_num=8
    trous_ligne=[]
    edge_offset=14.375
    for k in center_offsets:
        hole_num+= (math.floor((((Length/2) - edge_offset - k )/ pitch))*2)
        trous_ligne.append(math.floor((((Length/2) - edge_offset - k )/ pitch)))

#The second part of this gripper will mirror the trous_liste list to have the number of holes per row for the second half of the ExtruGrip and then with those two list it will create for each row a list of all the holes coordinates

    trous_ligne_inv=trous_ligne[::-1]
    List_coord=[]
    for k in center_offsets :
        i=center_offsets.index(k)
        Liste_temp=[]
        for j in range(trous_ligne[i]+1):
            Liste_temp.append(round((Length/2)-(k+j*pitch),3))
        for j in range(1,trous_ligne_inv[i]+1):
            Liste_temp.append(round((Length/2)-(k-j*pitch),3))
        Liste_temp.sort()
        List_coord.append(Liste_temp)

    return(hole_num,List_coord)

#This function will return the max. number of holes for a given width, length and pitch but also a list of list with all the coordinates of each hole for each row, for example for a 125x2500 extrugrip the result will be this :
# trous_liste = [7, 7, 7, 7]
# hole_num = 60
# List_coord = [[18.125, 33.125, 48.125, 63.125, 78.125, 93.125, 108.125, 123.125, 138.125, 153.125, 168.125, 183.125, 198.125, 213.125, 228.125], [25.625, 40.625, 55.625, 70.625, 85.625, 100.625, 115.625, 130.625, 145.625, 160.625, 175.625, 190.625, 205.625, 220.625, 235.625], [14.375, 29.375, 44.375, 59.375, 74.375, 89.375, 104.375, 119.375, 134.375, 149.375, 164.375, 179.375, 194.375, 209.375, 224.375], [21.875, 36.875, 51.875, 66.875, 81.875, 96.875, 111.875, 126.875, 141.875, 156.875, 171.875, 186.875, 201.875, 216.875, 231.875]]

#This fucntion will be used to find the longest list within a list of list
def maxi(L):
    c=0
    for k in L:
        if len(k)>c:
            c=len(k)
    return(c)


#the first part of the function just check if we are in Best Case Scenario (bcs) or Worst Case Scenario (wcs) Request using the 'bin' variable, it also checks the pitch and width
def bcs_or_wcs(w_product,List_coord,l_extru,bin,pitch,max_holes):
    sensitivity=sst.get()
    if pitch == 35 or pitch== 30:
        pitch_hole=18+sensitivity #this is where we can set up the sensibility of program, here if a product is tangent with a hole, the hole will be counted as covered (I could add the possibility to change it in the Graphic User Interface (GUI))
    else:
        pitch_hole=8+sensitivity

    if bin==1:
        wcs=0
    else:
        wcs=math.inf
    if w_product>=l_extru:
        return(max_holes) #if the product is equal or longer than the gripper we return the maximum number of holes

#In the second part of the program the check for every position with a 1mm increment of the product the number of holes covered. I could reduce the increment to have a more accurate result but I don't think our application need this level of precision.
#The program will only test half of the gripper length because there is no need to test the full length of the gripper since the hole pattern is always the same
    a=(w_product/2)-pitch_hole
    for k in np.arange(w_product/2,l_extru-(w_product/2), 1):
        compt=0
        for c in range(maxi(List_coord)):
            for i in List_coord:
                try:
                    if k-a<=i[c]<=k+a:
                        compt+=1
                except:
                    pass
        if 0 < compt < wcs and bin==0:
            wcs = compt
        elif compt > wcs and bin ==1:
             wcs = compt
    if wcs == math.inf:
        wcs=0
    print(List_coord,np.arange(w_product/2,l_extru-w_product/2, 1))
    return(wcs)
#It says return(wcs) but il will return the bcs or the wcs depending on the bin var

##GUI variable
result=None

##GUI functions
#All these functions are either to associate the functions above to the buttons or to prevent the user from doing something that could generate error or wrong results

#This function will give the result when the user will clikc on 'Calculate'
def click_button():
    global result

    eg_length=float(comboL.get())
    eg_width=float(comboW.get())
    pitch=float(comboP.get())
    w_product=float(entry.get())
    bin=float(checkBCS_var.get())

    nb_holes,List_coord=build_extrugrip(eg_length,pitch,eg_width)

    result=bcs_or_wcs(w_product,List_coord,eg_length,bin,pitch,nb_holes)

    label5.config(text=str(result))
    if entry2.get()!=None and len(entry2.get())!=0:
        calc_button.config(state=tk.NORMAL)


def comboW_selected(event):
#Prevent the user from clicking on two checkboxes at the same time
    selected_value = comboW.get()

    if selected_value == "125":
        comboP['values'] = ["15", "30"]
    else:
        comboP['values'] = ["17.5","35"]
    comboP.config(state="readonly")
    comboP.set('')
    calculate_button.config(state="disabled")
    check_changes()

def comboP_selected(event):
    selected_value = comboP.get()
    if selected_value != None:
        comboL.config(state="readonly")
    check_entry()
    check_changes()

def validate_entry(text):
    if text is None or len(text) == 0:
        return True
    # Check if the text can be converted to a float or integer
    try:
        float(text)
        return True
    except ValueError:
        return False

def validate_entry2(text):
    if text is None or len(text) == 0:
        return True
    # Check if the text can be converted to a float or integer
    try:
        float(text)
        return True
    except ValueError:
        return False

def check_changes(*args):
    calc_button.config(state="disabled")
    label5.config(text="")
    label7.config(text="")

def check_entry(*args):
    entry_text = entry.get()
    if entry_text and validate_entry(entry_text) and comboL.get()!='' and comboP.get()!='' and (checkBCS_var.get()==1 or checkWCS_var.get()==1):
        calculate_button.config(state="normal")
    else:
        calculate_button.config(state="disabled")

    check_changes()

def check_button_selected2(button):
    if button == 1:
        checkWCS.deselect()
    elif button == 2:
        checkBCS.deselect()
    check_entry()
    check_changes()

def lift():
    S=0
    lift_capt=0
    pitch=float(comboP.get())
    if pitch==30 or pitch==35:
        S=(math.pi*((16/2)**2))*(10**(-6))
    else:
        S=((math.pi*((8/2)**2))+(8*8))*(10**(-6))

    nb_hole=float(result)
    vac_lvl=float(entry2.get())

    if 0 < vac_lvl < 1000 :
        lift_capt=round(S*nb_hole*vac_lvl*10,2)
        lift_capt="handling capacity= "+str(lift_capt)+" kg"
        label7.config(text=lift_capt)
    else :
        label7.config(text="Vacuum lvl has to be under 999mbar")

def remove(*args):
    label7.config(text="")
    if entry2.get()!=None and len(entry2.get())!=0:
        calc_button.config(state=tk.NORMAL)
    else:
         calc_button.config(state=tk.DISABLED)


##GUI
# Create the main window
window = tk.Tk()
window.title("Extrugrip_Coverage_Calculator ")
window.geometry("270x550")

# Create the labels for comboboxes and the comboboxes
labelW = tk.Label(window, text="ExtruGrip Width")
labelW.pack()

comboW = ttk.Combobox(window, values=["125", "200"],state="readonly")
comboW.pack()
comboW.bind("<<ComboboxSelected>>", comboW_selected)

labelP = tk.Label(window, text="Pitch")
labelP.pack()

comboP = ttk.Combobox(window, values=["15","30","17.5","35"], state=tk.DISABLED,)
comboP.pack()
comboP.bind("<<ComboboxSelected>>", comboP_selected)

labelL = tk.Label(window, text="ExtruGrip Length")
labelL.pack()

comboL = ttk.Combobox(window, values=["250", "400", "600","800","1000","1200","1400"], state=tk.DISABLED)
comboL.bind("<<ComboboxSelected>>", check_entry)
comboL.pack()

# Create the label for text entry
text_label = tk.Label(window, text="Product Width (mm)")
text_label.pack()

# Create the text entry
validate_float_int = window.register(validate_entry)
entry = tk.Entry(window, validate="key", validatecommand=(validate_float_int, '%P'))
entry.bind("<KeyRelease>", check_entry)
entry.pack()

# Create the checkboxes
checkBCS_var = tk.IntVar()
checkBCS = tk.Checkbutton(window, text="Best Case Scenario", variable=checkBCS_var,command=lambda: check_button_selected2(1))
checkBCS.pack()

checkWCS_var = tk.IntVar()
checkWCS = tk.Checkbutton(window, text="Worst Case Scenario", variable=checkWCS_var,command=lambda: check_button_selected2(2))
checkWCS.pack()

#Create the sensitivity scale
sst = tk.Scale(window, from_=0, to=5,orient=tk.HORIZONTAL,length=130,resolution=0.5,label='Tolerance (mm):',command=check_changes)
sst.set(2.5)
sst.pack()

# Create the calculate button
calculate_button = tk.Button(window, text="Calculate", command=click_button,state=tk.DISABLED)
calculate_button.pack()

# Create labels below the button
label4 = tk.Label(window, text="Number of holes covered:  ")
label4.pack()

label5 = tk.Label(window, text="")
label5.pack()

# Create label for vac level
label6 = tk.Label(window, text="Enter a vacuum level (mbar)")
label6.pack()


# Create entry for vac level
validate_float_int = window.register(validate_entry2)
entry2 = tk.Entry(window, validate="key", validatecommand=(validate_float_int, '%P'))
entry2.bind("<KeyRelease>", remove )
entry2.pack()

# Create calculte button for lift cap
calc_button = tk.Button(window, text="Calculate", command=lift)
calc_button.pack()

# Create label to show lifting capacity
label7 = tk.Label(window, text="")
label7.pack()

#Check all the conditions before starting the GUI
check_entry()

# Start the GUI main loop
window.mainloop()


