
###
# L_boite = [[11,3,4,[2,2],[1,1,1,1]],[9,3,4,[1,3],[1,1,1,1]],[8,3,4,[4],[1,1,1,1]],[11,3,4,[1,1,1,1],[4]]]

# Take a row description list [11,3,4,[2,2],[1,1,1,1] and create a row with it
def create_row(L):
    Row=[0]
    c=0
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

def supr_duplicate(L):
    new_list = []
    for i in L :
        if i not in new_list:
            new_list.append(i)
    new_list.sort()
    return(new_list)

# Take a full data input (several row description list) and create a list with all the boxes position from each row
def merge_row(L):
    totRow=[]
    for i in L :
        L=[]
        L=create_row(i)
        for k in L:
            if k not in totRow:
                totRow.append(k)
        totRow.sort()
    return(totRow)

def Average(lst):
    return sum(lst) / len(lst)

# Take a list of boxes position and calculate zones (positions have to be >0)
def calculate_zone(L):
    zone=[L.pop(0)]
    avgL=[L[0]]
    avg=Average(avgL)
    for k in range(len(L)-1):
        if avg-2.54<L[k+1]<avg+2.54:
            avgL.append(L[k+1])
            avg=Average(avgL)
        else:
            zone.append(avg)
            avgL=[L[k+1]]
            avg=Average(avgL)
    zone.append(L[len(L)-1])
    return(zone)

def center_row(L):
    l=len(L)
    e=L[l-1]
    for k in range(len(L)):
        L[k]=L[k]-(e/2)
    return(L)

def draw_zone(L,w):
    c1=L.pop(0)
    c2=L.pop(-1)
    draw_square(c2,c1,w)
    for k in L:
        plt.plot([0,w],[k,k])
    # plt.show()
    L.insert(0,c1)
    L.append(c2)
    # plt.show()

def draw_square(h,b,l):
    plt.plot([0,0],[b,h],'k')
    plt.plot([l,l],[b,h],'k')
    plt.plot([0,l],[h,h],'k')
    plt.plot([0,l],[b,b],'k')
    plt.show()

# Take a full data input, a conveyor position and give the position of the zones:
def output(L,bin):
    output=[]

# bin = 0 or 1, 1 if centered
    if bool(bin):
        output=calculate_zone(center_row(merge_row(L)))
    else:
        output=calculate_zone(merge_row(L))
    return(output)


rez=0
rez=output(L_boite, 1)
draw_zone(rez,5)

