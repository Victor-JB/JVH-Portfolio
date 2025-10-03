##Import
import matplotlib.pyplot as plt
import tkinter as tk
import pandas as pd
from tkinter import filedialog
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

##Zones Calculation Functions
#Take a row description list, i.e a list fo list like this  : [11,3,4,'2,2','1,1,1,1'] and create a row with it
def create_row(L):
    Row=[0]
    c=0
    # print(L,'create row L')
    for k in L[3]:
        c=c+k*L[0]
        Row.append(c)
    c=0
    for k in L[4]:
        c=c+k*L[0]
        Row.append(c)
    if L[0]*L[2] not in Row:
        Row.append(L[0]*L[2])
    Row=supr_duplicate(Row)
    return(Row)

#Take a full data input (several row description list) and create a list with all the boxes position from each row
def merge_row(L,bin):
    totRow=[]
    for i in L :
        L=[]
        L=create_row(i)
        if bool(bin):
            L=center_row(L)
        for k in L:
            if k not in totRow:
                totRow.append(k)
        totRow.sort()
    return(totRow)

#Take a list of boxes position and calculate zones
def calculate_zone(L):
    print(L)
    c=float(entry.get())
    zone_bgn=[L.pop(0)]
    zone_end=[L.pop(len(L)-1)]

    removeM, removeP =[],[]
    for k in L:
        # print(k,'k',zone_bgn[0],'zone bgn',zone_end[0],'zone end')
        #add one si un des deux pas vide
        if zone_bgn[0]-c<=k<=zone_bgn[0]+c:
            # print('inside loop',k)
            removeM.append(k)
        if zone_end[0]-c<=k<=zone_end[0]+c:
            removeP.append(k)

    for k in removeM:
        L.remove(k)
    for k in removeP:
        L.remove(k)

    print(L,'removed')

    zone=[]
    avgL=[L[0]]
    avg=Average(avgL)
    # deadZ=[]
    # deadZ_temp=[]
    # print(zone,avgL,avg,'begin calculate zone')
    comp=L[0]
    for k in range(len(L)-1):
        # print(k,'k',L[k])
        # print(L[k+1])
        if comp-c<=L[k+1]<=comp+c:
            avgL.append(L[k+1])
            # deadZ_temp.append(L[k])
            # deadZ_temp.append(L[k+1])
            avg=Average(avgL)
            print('inside loop 2',L[k+1],avg,avgL)
        else:
            zone.append(avg)
            avgL=[L[k+1]]
            comp=L[k+1]
            avg=Average(avgL)
            # deadZ.append(list(set(deadZ_temp)))
            # deadZ_temp=[]
    zone.append(avg)
    if removeM != []:
        zone_bgn=zone_bgn+[zone_bgn[0]+c]
    if removeP != []:
        zone_end=[zone_end[0]-c]+zone_end
    zone=zone_bgn+zone+zone_end
    # print(zone,'zone',deadZ)
    # for i in range(len(deadZ)-1):
    #     deadZ[i]=[deadZ[i][0],deadZ[i][-1]]
    # print(deadZ,'finit0')
    print(zone,'zone')
    return(zone)

##Fonctions Annexes
def supr_duplicate(L):
    new_list = []
    for i in L :
        if i not in new_list:
            new_list.append(i)
    new_list.sort()
    return(new_list)

def Average(lst):
    return sum(lst) / len(lst)

def max_width(L):
    m=0
    for k in L:
        if k[2]>m:
            m=k[2]
    return(m)

def center_row(L):
    l=len(L)
    e=L[l-1]
    for k in range(len(L)):
        L[k]=L[k]-(e/2)
    return(L)

def draw_zone(L,w):
    # print(L,w)
    c1=L.pop(0)
    c2=L.pop(-1)
    # print(L,'L - draw zone')
    draw_square(c2,c1,w)
    for k in L:
        plt.plot([0,w],[k,k])
    L.insert(0,c1)
    L.append(c2)
    # ax = plt.gca() #you first need to get the axis handle
    # print(ax)
    # ax.set_aspect('equal') #sets the height to width ratio to 1.5.
    # print(ax)

def draw_square(h,b,l):
    plt.plot([0,0],[b,h],'k')
    plt.plot([l,l],[b,h],'k')
    plt.plot([0,l],[h,h],'k')
    plt.plot([0,l],[b,b],'k')

##Compilation
#Take a full data input, a conveyor position and give the position of the zones:
def output(L,bin):
    # print(merge_row(L,1),'center')
    # print(merge_row(L,0),'zero')
    output=[]
    output=calculate_zone(merge_row(L,bin))
    return(output)

##Global Variables
data=[]
w=0
clicked=False

##Functions for GUI - Loading Spreadsheet
def select_file():
    global clicked

    file_path = filedialog.askopenfilename(filetypes=[("Excel Files", "*.xlsx")])

    # print(file_path,type(file_path),file_path[-9:])

    try:
        if file_path:
            file_label.config(text=file_path)
            load_button.config(state=tk.NORMAL)
        else:
            file_label.config(text="No file selected.")
            load_button.config(state=tk.DISABLED)
    except:
        text_area.delete(1.0, tk.END)
        text_area.insert(tk.END, f"Error loading file")

    clicked=False
    check_conditions()

def load_file():
    global data
    global clicked

    file_path = file_label.cget("text")
    testing=file_path[-8:]!='ZCT.xlsx'
    # print(file_path,'oo',file_path[-8:],file_path[-9:]!='ZCT.xlsx')

    try:
        10/(True-testing)
        df = pd.read_excel(file_path)
        display_data(df)
        columns = df.columns[:5].tolist()
        data = remove_string(df[columns].values.tolist())
        w=max_width(data)
        # print(data,w)
        file_label.config(text='File successfully loaded - Preview :')
        # print(type(data))
        load_button.config(state=tk.DISABLED)
        # return(data)

    except Exception as e:
        text_area.delete(1.0, tk.END)
        # text_area.insert(tk.END, f"Error loading file: {e}")
        text_area.insert(tk.END, "Error loading file: Wrong File")
        load_button.config(state=tk.DISABLED)

    clicked=True
    check_conditions()


def display_data(df):
    text_area.delete(1.0, tk.END)
    text_area.insert(tk.END, df)


##Annex Functions for Calculation
def remove_string(L):
    for k in L:
        temp=[]
        if type(k[3]) == type(''):
            for i in k[3]:
                # print(i)
                try :
                    float(i)
                    # print('in')
                    temp.append(float(i))
                except :
                    None
            k[3]=temp
        else:
            k[3]=[k[3]]

        temp2=[]
        if type(k[4]) == type(''):
            for i in k[4]:
                # print(i)
                try :
                    float(i)
                    # print('in2')
                    temp2.append(float(i))
                except :
                    None
            k[4]=temp2
        else:
            k[4]=[k[4]]
    return(L)

def check_button_selected(button):
    if button == 1:
        zero_line.deselect()
    elif button == 2:
        center.deselect()
    check_conditions()

def get_var():
    return(center_var.get())

def check_conditions(*args):
    entry_text = entry.get()
    if (center_var.get()==True or zero_line_var.get()==True) and clicked==True and entry_text and validate_entry(entry_text):
        calculation.config(state=tk.NORMAL)
    else:
        calculation.config(state=tk.DISABLED)

##Calculation function
def calculate(L):
    global w
    # global deadZ
    w=max_width(L)
    var=get_var()
    # print(var,'var')
    Final_Result=[]
    Final_Result=calculate_zone(merge_row(L,var))
    # print(Final_Result,'FR',w)
    draw_zone(Final_Result,w)
    plt.show()

    # print(Final_Result)
    FR_round=[round(k,1) for k in Final_Result]
    coordinates.config(text='Zones cooridnates are ' + str(FR_round))

def call_another_function():
    calculate(data)

###GUI
root = tk.Tk()
root.title("Zone Calculation Tool")

##Variables
center_var = tk.BooleanVar()
zero_line_var = tk.BooleanVar()

##Buttons
center = tk.Checkbutton(root, text="Centered",variable=center_var, command=lambda: check_button_selected(1))
center.grid(row=5, column=1,sticky='E')

zero_line = tk.Checkbutton(root, text="Zero Line",variable=zero_line_var, command=lambda: check_button_selected(2))
zero_line.grid(row=5, column=1,sticky='W')

calculation = tk.Button(root, text="Calculate", command=call_another_function, state=tk.DISABLED)
calculation.grid(row=9, column=1)

load_button = tk.Button(root, text="Load File", command=load_file, state=tk.DISABLED)
load_button.grid(row=2, column=1)

##Labels
# Create a label and button for file selection
title=tk.Label(root, text='Zone Calculation Tool for Palettisation')
title.grid(row=0, column=1)

file_label = tk.Label(root, text="No file selected.")
file_label.grid(row=3, column=1)

file_button = tk.Button(root, text="Select File", command=select_file)
file_button.grid(row=1, column=1)

coordinates = tk.Label(root, text=None)
coordinates.grid(row=10,column=1)

# Create a text area to display the loaded Excel data
text_area = tk.text_widget = tk.Text(root, width=35, height=5, wrap="none")

yscrollbar = tk.Scrollbar(root, orient="vertical", command=text_area.yview)
text_area.configure(yscrollcommand=yscrollbar.set)
yscrollbar.grid(row=4,column=2,sticky="ns")

text_area.grid(row=4, column=1)

#Create entry for min zone size
def validate_entry(text):
    if text is None or len(text) == 0:
        return True
    # Check if the text can be converted to a float or integer
    try:
        float(text)
        return True
    except ValueError:
        return False

validate_float_int = root.register(validate_entry)
entry = tk.Entry(root, width=7, validate="key", validatecommand=(validate_float_int, '%P'))
entry.bind("<KeyRelease>", check_conditions)
entry.grid(row=7, column=1)

minZone_label = tk.Label(root, text="Minimum zone size (mm) :")
minZone_label.grid(row=6, column=1)


##END
check_conditions()
root.mainloop()
