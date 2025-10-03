import tkinter as tk

def draw_rectangle(canvas, x, y, width, height):
    canvas.create_rectangle(x, y, x + width, y + height, outline='black')

def draw_vertical_line(canvas, x, y1, y2):
    canvas.create_line(x, y1, x, y2, fill='red')  # Adjust the color as needed

# Example values for width and height
rectangle_width = 50
rectangle_height = 30

# Create main window
root = tk.Tk()
root.title("Drawing Shapes")

# Create canvas
canvas = tk.Canvas(root, width=500, height=500)
canvas.pack()

# Draw a rectangle on the canvas
draw_rectangle(canvas, 50, 50, rectangle_width, rectangle_height)

# Draw a vertical line on the canvas
draw_vertical_line(canvas, 120, 50, 80)  # Adjust the coordinates as needed

# You can draw more rectangles and lines with different coordinates and dimensions here

# Start the Tkinter event loop
root.mainloop()
##
3 parametres principaux
List Inputs
List bool
List zone
but : creer une liste de canvas
##
import tkinter as tk

def draw_rectangle_with_lines(canvas, x, y, L, W, coordinates,color):
    # Draw the main rectangle
    canvas.create_rectangle(x, y, x + L, y + W, outline=color)
    # canvas.create_rectangle(50, 50, 450, 450, outline='blue')

    # Draw vertical lines at specified coordinates
    for coord in coordinates:
        canvas.create_line(x + coord, y, x + coord, y + W, fill='red')  # Adjust color as needed

# Example values multiplied by 20
rectangle_width = 12 * 40
rectangle_length = 4 * 40
origin_x = 50
origin_y = 50
coordinates_list = [2 * 40, 3 * 40, 4 * 40, 6 * 40, 8 * 40, 9 * 40, 10 * 40]

# Create main window
root = tk.Tk()
root.title("Drawing Shapes")

# Create canvas with a larger width
canvas = tk.Canvas(root, width=1000, height=666)
canvas.pack()

# Draw the rectangle with vertical lines
draw_rectangle_with_lines(canvas, origin_x, origin_y, rectangle_width, rectangle_length, coordinates_list)

# Start the Tkinter event loop
root.mainloop()
# maxiW=sum([k.W for k in InputL]) + len(L)*50

##
#Creer une liste de canvas :
def CanvasList(InputL,BoolL,ZoneL):
    root = tk.Tk()
    root.title("Drawing Shapes")

    CanvasList=[]
    maxiL=max([max(k.Row()) for k in InputL])
    maxiW=max([k.W for k in InputL])
    print(maxiL,maxiW,'maxi')
    scale=900/maxiL
    print(scale,'scale',maxiW*scale*3 + 150)
    CH=sum([(k.W)*scale for k in InputL]) + len(InputL)*50
    print(CH,'CH')
    originX=50
    originY=50

    for i in InputL:
        k=InputL.index(i)
        pickL=[k*scale for k in i.pickL()]
        releaseL=[k*scale for k in i.releaseL()]
        ZoneLs=[k*scale for k in ZoneL]
        Row=i.Row()
        print(k,pickL,releaseL)
        canvas = tk.Canvas(root, width=1000, height=1000)
        canvas.pack()

        # if bool(BoolL[k]):
        #     pickL=center_row2(pickL)
        #     releaseL=center_row2(releaseL)

        print(Row,'Row')
        print(pickL[-1],i.W*scale,Row[1:-1],'aaa')

        pick= draw_rectangle_with_lines(canvas, originX, originY, originX + pickL[-1]*scale, originY + i.W*scale, pickL[1:-1],'black')

        gripper=draw_rectangle_with_lines(canvas,originX,originY+50+i.W*scale, 950, originY+(maxiW*scale),ZoneLs,'blue')

        release=draw_rectangle_with_lines(canvas,originX,originY+100+maxiW*scale, releaseL[-1]*scale, i.W*scale, releaseL[1:-1],'green')

        CanvasList.append(canvas)

    print(CanvasList)

    root.mainloop()


ZoneL=[0.0, 3.75, 9.0, 12.0]
InpuL=[Input(3,5,4,[4],[1,1,1,1]),Input(2,4,5,[4,1],[1,1,1,1,1])]
Lb=[1,0]

CanvasList(InpuL,Lb,ZoneL)
