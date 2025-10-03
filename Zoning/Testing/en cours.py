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